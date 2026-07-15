import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { Innertube } from 'youtubei.js';
import dotenv from 'dotenv';
import fs from 'fs';

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
// Firebase is initialized

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const SYSTEM_PROMPT = `
You are an AI that extracts K-Pop comeback/release schedule information from YouTube community posts.
Determine if the provided text is announcing a new comeback, debut, or album/single release.
If it is, extract the date (in YYYY-MM-DD format if possible, estimating the year if only month/day are given and it's for 2026/current year) and the title.
Respond ONLY with a valid JSON object (no markdown formatting, no backticks, just raw JSON).
Format:
{
  "isComeback": boolean,
  "date": "YYYY-MM-DD" | null,
  "title": "Album/Single title" | null,
  "type": "mini" | "full" | "single" | "repackage" | "unknown"
}
`;

async function analyzeWithGemini(text: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: SYSTEM_PROMPT },
        { text: `Text to analyze:\n${text}` }
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

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Gemini API Error: ${errorText}`);
    return null;
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", content);
    return null;
  }
}

async function run() {
  const yt = await Innertube.create();
  
  console.log("Fetching artists from Firestore...");
  const snapshot = await getDocs(collection(db, 'artists'));
  const artists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
  
  console.log("Fetching all comebacks to optimize queries...");
  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  const allComebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));
  
  const comebackKeys = new Set<string>();
  for (const cb of allComebacks) {
    comebackKeys.add(`${cb.artistId}_${cb.date || cb.releaseDate}`);
  }
  
  // For safety, let's just do a limited run or specific ones that the user might want.
  // Actually, we'll run through all artists that have a YouTube link.
  let processed = 0;
  
  for (const artist of artists) {
    const ytUrl = artist.socialLinks?.youtube;
    if (!ytUrl) continue;
    
    // Check if we already processed them recently? For now just fetch.
    console.log(`\n[${++processed}/${artists.length}] Checking ${artist.name} (${ytUrl})`);
    
    try {
      const urlInfo = await yt.resolveURL(ytUrl);
      const channelId = urlInfo.payload.browseId;
      if (!channelId) {
        console.log(`  -> Could not resolve channel ID.`);
        continue;
      }
      
      const chan = await yt.getChannel(channelId);
      const community = await chan.getCommunity();
      
      if (!community.posts || community.posts.length === 0) {
        console.log(`  -> No community posts found.`);
        continue;
      }
      
      // Analyze the latest 3 posts
      for (const post of community.posts.slice(0, 3)) {
        const text = post.content?.text;
        if (!text) continue;
        
        // Fast pre-filter to save API calls
        const lowerText = text.toLowerCase();
        if (!lowerText.includes('comeback') && !lowerText.includes('release') && 
            !lowerText.includes('컴백') && !lowerText.includes('발매') &&
            !lowerText.includes('teaser') && !lowerText.includes('티저') &&
            !lowerText.includes('schedule') && !lowerText.includes('스케줄')) {
          continue; // Skip if no obvious keywords
        }
        
        console.log(`  -> Found potential post, sleeping 4.5s for rate limit, then analyzing with AI...`);
        await sleep(4500); // 15 RPM limit for Free Tier
        const result = await analyzeWithGemini(text);
        
        if (result && result.isComeback && result.date) {
          console.log(`  🎉 AI DETECTED COMEBACK! ${result.date} - ${result.title} (${result.type})`);
          
          // Check if comeback already exists
          const key = `${artist.id}_${result.date}`;
          if (!comebackKeys.has(key)) {
            const comebacksRef = collection(db, 'comebacks');
            await addDoc(comebacksRef, {
              artistId: artist.id,
              artistName: artist.name,
              title: result.title || 'Untitled',
              date: result.date,
              type: result.type || 'unknown',
              createdAt: new Date().toISOString() // Client SDK simple timestamp
            });
            console.log(`  ✅ Inserted into Firestore!`);
          } else {
            console.log(`  ℹ️ Comeback already exists in DB.`);
          }
        }
      }
      
    } catch (err) {
      console.log(`  ❌ Error processing ${artist.name}: ${err.message}`);
    }
  }
  
  console.log("\nFinished processing all YouTube community tabs!");
  process.exit(0);
}

run();
