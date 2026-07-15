import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import Parser from 'rss-parser';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("No GEMINI_API_KEY found!");
  process.exit(1);
}

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const parser = new Parser();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const SYSTEM_PROMPT = `
You are an AI that extracts K-Pop comeback/release schedule information from news article titles.
Determine if the provided news title is announcing a new comeback, debut, or album/single release for the specified artist.
If it is, extract the date (in YYYY-MM-DD format if possible, estimating the year to 2026 if only month/day are given) and the album/single title.
Respond ONLY with a valid JSON object (no markdown formatting).
Format:
{
  "isComeback": boolean,
  "date": "YYYY-MM-DD" | null,
  "title": "Album/Single title" | null,
  "type": "mini" | "full" | "single" | "repackage" | "unknown"
}
`;

async function analyzeWithGemini(artistName: string, text: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: SYSTEM_PROMPT },
        { text: `Artist: ${artistName}\nNews Title: ${text}` }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) return null;
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log("Fetching artists from Firestore...");
  const snapshot = await getDocs(collection(db, 'artists'));
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log("Fetching all comebacks to optimize queries...");
  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  const allComebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));
  
  const comebackKeys = new Set<string>();
  for (const cb of allComebacks) {
    comebackKeys.add(`${cb.artistId}_${cb.date || cb.releaseDate}`);
  }
  
  // Sort artists by popularity or random to distribute API load? 
  // Let's just process them all.
  let processed = 0;
  
  for (const artist of artists) {
    processed++;
    // Google News RSS URL for: "ArtistName 컴백" over the last 7 days
    const qStr = `"${artist.name}" 컴백 when:7d`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(qStr)}&hl=ko&gl=KR&ceid=KR:ko`;
    
    try {
      const feed = await parser.parseURL(rssUrl);
      if (!feed.items || feed.items.length === 0) {
        continue;
      }
      
      console.log(`\n[${processed}/${artists.length}] 📰 Found news for ${artist.name}`);
      
      // Take the top 2 most recent relevant news articles
      for (const item of feed.items.slice(0, 2)) {
        const title = item.title || '';
        console.log(`  -> Analyzing Title: ${title}`);
        
        await sleep(4500); // Respect Gemini API limits (15 RPM)
        const result = await analyzeWithGemini(artist.name, title);
        
        if (result && result.isComeback && result.date) {
          console.log(`  🎉 AI DETECTED COMEBACK! ${result.date} - ${result.title} (${result.type})`);
          
          const key = `${artist.id}_${result.date}`;
          if (!comebackKeys.has(key)) {
            const comebacksRef = collection(db, 'comebacks');
            await addDoc(comebacksRef, {
              artistId: artist.id,
              artistName: artist.name,
              title: result.title || 'Untitled',
              date: result.date,
              type: result.type || 'unknown',
              status: 'ANNOUNCED',
              createdAt: new Date().toISOString()
            });
            console.log(`  ✅ Inserted into Firestore!`);
          } else {
            console.log(`  ℹ️ Comeback already exists in DB.`);
          }
          break; // If we found one, we don't need to parse older articles for the same artist
        }
      }
    } catch (err) {
      console.log(`  ❌ Error processing news for ${artist.name}:`, err.message);
    }
  }
  
  console.log("\nFinished processing all Google News feeds!");
  process.exit(0);
}

run();
