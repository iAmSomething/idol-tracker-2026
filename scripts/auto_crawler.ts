import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, limit } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const parser = new Parser();

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface ParsedComeback {
  isComeback: boolean;
  artistName: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  releaseType: "full" | "mini" | "single";
}

interface ArtistDoc {
  id: string;
  name: string;
  lastCrawledAt?: Date;
}

async function getActiveArtistsBatch(limitCount: number): Promise<ArtistDoc[]> {
  const snapshot = await getDocs(collection(db, "artists"));
  const artists = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      lastCrawledAt: data.lastCrawledAt ? new Date(data.lastCrawledAt) : new Date(0)
    } as ArtistDoc;
  }).filter(a => a.name);

  // Sort deterministically: oldest crawled first (newly added artists without timestamp go first)
  artists.sort((a, b) => (a.lastCrawledAt?.getTime() || 0) - (b.lastCrawledAt?.getTime() || 0));

  return artists.slice(0, limitCount);
}

async function fetchNewsForArtist(artist: string) {
  const queryStr = encodeURIComponent(`"${artist}" (컴백 OR 신곡 OR 발매)`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  
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
      const text = response.text.trim();
      const cleaned = text.startsWith("```") ? text.replace(/^```json\s*/i, "").replace(/```$/, "").trim() : text;
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed as ParsedComeback[];
      }
    }
  } catch (e) {
    console.error("Gemini Parser Error:", e);
  }
  return [];
}

async function runCrawler() {
  console.log("Starting Auto Crawler (Deterministic Rotation)...");
  
  // Deterministic sliding window: crawl 40 artists at a time
  const batchSize = 40;
  const artists = await getActiveArtistsBatch(batchSize);
  console.log(`Selected batch of ${artists.length} artists for deterministic crawling.`);

  let allNews = [];
  
  // Crawl and update lastCrawledAt timestamp for rotation
  for (const artist of artists) {
    console.log(` -> Fetching news for: "${artist.name}"`);
    const news = await fetchNewsForArtist(artist.name);
    allNews.push(...news);

    try {
      await updateDoc(doc(db, "artists", artist.id), {
        lastCrawledAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Failed to update timestamp for artist ${artist.name}:`, e);
    }

    await new Promise(r => setTimeout(r, 800)); // Politeness sleep
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
        releaseDate: new Date(cb.releaseDate).toISOString().split('T')[0], // Store date string consistently
        releaseType: cb.releaseType,
        agencyName: "Unknown",
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200", // Fallback placeholder
        createdAt: new Date().toISOString(),
      });
      
      // Update artist recentComeback
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
      console.log(`Comeback already tracked: ${cb.artistName} - ${cb.title}`);
    }
  }

  console.log("Crawl complete.");
  process.exit(0);
}

runCrawler().catch(console.error);
