import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const parser = new Parser();

const configPath = path.resolve(process.cwd(), "app/firebase.ts");
const firebaseTsContent = fs.readFileSync(configPath, "utf-8");
const apiKeyMatch = firebaseTsContent.match(/apiKey:\s*"([^"]+)"/);
const projectIdMatch = firebaseTsContent.match(/projectId:\s*"([^"]+)"/);

if (!apiKeyMatch || !projectIdMatch) {
  console.error("Could not extract Firebase config");
  process.exit(1);
}

const app = initializeApp({
  apiKey: apiKeyMatch[1],
  projectId: projectIdMatch[1],
});
const db = getFirestore(app);

interface ParsedComeback {
  isComeback: boolean;
  artistName: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  releaseType: "full" | "mini" | "single";
}

async function getActiveArtists(): Promise<string[]> {
  const snapshot = await getDocs(collection(db, "artists"));
  return snapshot.docs.map(doc => doc.data().name).filter(Boolean);
}

async function fetchNewsForArtist(artist: string) {
  const query = encodeURIComponent(`"${artist}" (컴백 OR 신곡 OR 발매)`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;
  
  try {
    const feed = await parser.parseURL(url);
    // Return only items from the last 3 days
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return feed.items
      .filter(item => item.isoDate && new Date(item.isoDate).getTime() > threeDaysAgo)
      .map(item => ({ artist, title: item.title, link: item.link, pubDate: item.pubDate }));
  } catch (e) {
    console.error(`Error fetching news for ${artist}:`, e);
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
      return JSON.parse(response.text) as ParsedComeback[];
    }
  } catch (e) {
    console.error("Gemini Error:", e);
  }
  return [];
}

async function runCrawler() {
  console.log("Starting Auto Crawler...");
  const artists = await getActiveArtists();
  console.log(`Tracking ${artists.length} artists.`);

  let allNews = [];
  
  // Throttle fetches to avoid rate limits
  for (const artist of artists) {
    // Just a sample to not overwhelm the script during testing
    // In production, you would run this in batches
    if (Math.random() < 0.1) { // Randomly pick ~10% for the test run
        const news = await fetchNewsForArtist(artist);
        allNews.push(...news);
        await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Found ${allNews.length} recent news items. Verifying with Gemini...`);

  const chunkSize = 20;
  const verifiedComebacks: ParsedComeback[] = [];

  for (let i = 0; i < allNews.length; i += chunkSize) {
    const chunk = allNews.slice(i, i + chunkSize);
    const parsed = await verifyWithGemini(chunk);
    verifiedComebacks.push(...parsed.filter(p => p.isComeback));
  }

  console.log(`Gemini identified ${verifiedComebacks.length} true comebacks.`);

  for (const cb of verifiedComebacks) {
    // Check if it already exists
    const q = query(
      collection(db, "comebacks"), 
      where("artistName", "==", cb.artistName),
      where("title", "==", cb.title)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log(`New comeback found! ${cb.artistName} - ${cb.title} (${cb.releaseDate})`);
      
      await addDoc(collection(db, "comebacks"), {
        artistName: cb.artistName,
        title: cb.title,
        releaseDate: new Date(cb.releaseDate),
        releaseType: cb.releaseType,
        agencyName: "Unknown", // Can be inferred by joining with artists collection
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200", // Fallback placeholder
        createdAt: new Date(),
      });
      
      // Update artist recentComeback
      const artistQ = query(collection(db, "artists"), where("name", "==", cb.artistName));
      const artistSnap = await getDocs(artistQ);
      if (!artistSnap.empty) {
        await updateDoc(doc(db, "artists", artistSnap.docs[0].id), {
          recentComeback: {
            title: cb.title,
            date: new Date(cb.releaseDate),
            type: cb.releaseType
          }
        });
      }
    } else {
      console.log(`Comeback already tracked: ${cb.artistName} - ${cb.title}`);
    }
  }

  console.log("Crawl complete.");
  process.exit(0);
}

runCrawler();
