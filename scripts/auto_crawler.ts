import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db, getActiveArtistsBatch } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.GEMINI_API_KEY) {
  logger.error("GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const parser = new Parser();

interface ParsedComeback {
  isComeback: boolean;
  artistName: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  releaseType: "full" | "mini" | "single";
}

async function fetchNewsForArtist(artist: string) {
  const queryStr = encodeURIComponent(`"${artist}" (컴백 OR 신곡 OR 발매)`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  
  try {
    const feed = await parser.parseURL(url);
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return feed.items
      .filter(item => item.isoDate && new Date(item.isoDate).getTime() > threeDaysAgo)
      .map(item => ({ artist, title: item.title, link: item.link, pubDate: item.pubDate }));
  } catch (e) {
    logger.error(`Error fetching news for ${artist}:`, e);
    return [];
  }
}

async function verifyWithGemini(newsItems: any[]): Promise<ParsedComeback[]> {
  if (newsItems.length === 0) return [];

  const prompt = `
  You are a K-Pop news analyst. Review these news headlines.
  Identify ONLY official announcements for a NEW ALBUM or SONG COMEBACK.
  Ignore rumors, concerts, fanmeets, charting, OSTs, or TV show appearances.
  
  For each confirmed comeback, extract:
  - artistName
  - title (the name of the album/song, if available. otherwise "TBA")
  - releaseDate in YYYY-MM-DD
  - releaseType ("full", "mini", "single")

  Return a JSON array of objects with keys: "isComeback", "artistName", "title", "releaseDate", "releaseType".
  Return ONLY the JSON array.

  Headlines:
  ${JSON.stringify(newsItems, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    if (response.text) {
      const text = response.text.trim();
      const cleaned = text.startsWith("```") ? text.replace(/^```json\s*/i, "").replace(/```$/, "").trim() : text;
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed as ParsedComeback[];
      }
    }
  } catch (e) {
    logger.error("Gemini Parser Error:", e);
  }
  return [];
}

async function runCrawler() {
  logger.info("Starting Auto Crawler (Deterministic Rotation)...");
  
  const batchSize = 40;
  const artists = await getActiveArtistsBatch(batchSize);
  logger.info(`Selected batch of ${artists.length} artists for deterministic crawling.`);

  let allNews = [];
  
  for (const artist of artists) {
    logger.info(` -> Fetching news for: "${artist.name}"`);
    const news = await fetchNewsForArtist(artist.name);
    allNews.push(...news);

    try {
      await updateDoc(doc(db, "artists", artist.id), {
        lastCrawledAt: new Date().toISOString()
      });
    } catch (e) {
      logger.error(`Failed to update timestamp for artist ${artist.name}:`, e);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  logger.info(`Found ${allNews.length} recent news items. Verifying with Gemini...`);

  const chunkSize = 20;
  const verifiedComebacks: ParsedComeback[] = [];

  for (let i = 0; i < allNews.length; i += chunkSize) {
    const chunk = allNews.slice(i, i + chunkSize);
    const parsed = await verifyWithGemini(chunk);
    verifiedComebacks.push(...parsed.filter(p => p.isComeback));
  }

  logger.info(`Gemini identified ${verifiedComebacks.length} true comebacks.`);

  for (const cb of verifiedComebacks) {
    const q = query(
      collection(db, "comebacks"), 
      where("artistName", "==", cb.artistName),
      where("title", "==", cb.title)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
      logger.info(`New comeback found! ${cb.artistName} - ${cb.title} (${cb.releaseDate})`);
      
      await addDoc(collection(db, "comebacks"), {
        artistName: cb.artistName,
        title: cb.title,
        releaseDate: new Date(cb.releaseDate).toISOString().split('T')[0],
        releaseType: cb.releaseType,
        agencyName: "Unknown",
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200",
        createdAt: new Date().toISOString(),
      });
      
      const artistQ = query(collection(db, "artists"), where("name", "==", cb.artistName));
      const artistSnap = await getDocs(artistQ);
      if (!artistSnap.empty) {
        await updateDoc(doc(db, "artists", artistSnap.docs[0].id), {
          recentComeback: {
            title: cb.title,
            date: cb.releaseDate,
            type: cb.releaseType
          }
        });
      }
    } else {
      logger.info(`Comeback already tracked: ${cb.artistName} - ${cb.title}`);
    }
  }

  logger.info("Crawl complete.");
  process.exit(0);
}

runCrawler().catch(e => {
  logger.error("Auto Crawler Critical Failure:", e);
  process.exit(1);
});
