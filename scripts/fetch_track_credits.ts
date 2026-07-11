import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import * as cheerio from 'cheerio';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log("🚀 Starting Track Credits Parser (Composers & Lyricists)...");

  // 1. Fetch recent comebacks to prioritize their tracks
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  comebacks.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  const recentComebackIds = new Set(comebacks.slice(0, 40).map(c => c.id));
  
  // 2. Fetch all tracks
  const tracksSnap = await getDocs(collection(db, "tracks"));
  const tracks = tracksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  // Filter to tracks that have Bugs links but don't have composers yet
  const targets = tracks.filter(t => 
    t.streamingLinks?.bugs && 
    (!t.composers || t.composers.length === 0)
  );

  // Sort: recent comebacks first
  targets.sort((a, b) => {
    const aRecent = recentComebackIds.has(a.comebackId) ? 1 : 0;
    const bRecent = recentComebackIds.has(b.comebackId) ? 1 : 0;
    return bRecent - aRecent;
  });

  // 3. Batch backfill artistName and albumTitle for all tracks that are missing them
  console.log("3️⃣ Backfilling artistName and albumTitle for tracks...");
  const comebacksMap = new Map();
  comebacks.forEach(c => comebacksMap.set(c.id, c));

  let batch = writeBatch(db);
  let opCount = 0;
  let backfillCount = 0;
  
  for (const track of tracks) {
    if (!track.artistName || !track.albumTitle) {
      const cb = comebacksMap.get(track.comebackId);
      if (cb) {
        const updatePayload: any = {};
        if (!track.artistName) updatePayload.artistName = cb.artistName || "";
        if (!track.albumTitle) updatePayload.albumTitle = cb.albumTitle || "";
        
        batch.update(doc(db, "tracks", track.id), updatePayload);
        opCount++;
        backfillCount++;
        
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }
  }
  if (opCount > 0) {
    await batch.commit();
  }
  console.log(`✅ Backfill complete! Updated ${backfillCount} tracks.`);

  console.log(`Found ${targets.length} tracks requiring credits enrichment. Processing top 150...`);
  
  const toProcess = targets.slice(0, 150);
  let processedCount = 0;

  for (const track of toProcess) {
    const bugsUrl = track.streamingLinks.bugs;
    const trackIdMatch = bugsUrl.match(/\/track\/(\d+)/);
    if (!trackIdMatch) continue;
    const trackId = trackIdMatch[1];

    console.log(`[${processedCount + 1}/${toProcess.length}] Fetching credits for track: "${track.name}" (${track.id})`);
    
    try {
      const res = await fetch(`https://music.bugs.co.kr/track/${trackId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) {
        console.log(`   -> Failed to fetch page. Status: ${res.status}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const composers: string[] = [];
      const lyricists: string[] = [];

      const td = $("table.info tbody tr").filter((_, el) => $(el).find('th').text().trim() === '참여 정보').find('td');
      if (td.length > 0) {
        td.find('span.title').each((_, spanTitle) => {
          const type = $(spanTitle).text().trim();
          const nextSpan = $(spanTitle).next('span');
          if (nextSpan.length > 0) {
            const names = nextSpan.find('a').map((_, a) => $(a).text().trim()).get();
            if (type === '작곡') {
              composers.push(...names);
            } else if (type === '작사') {
              lyricists.push(...names);
            }
          }
        });
      }

      const cb = comebacksMap.get(track.comebackId);
      const artistName = cb ? (cb.artistName || "") : "";
      const albumTitle = cb ? (cb.albumTitle || "") : "";

      await updateDoc(doc(db, "tracks", track.id), {
        composers,
        lyricists,
        artistName,
        albumTitle,
        updatedAt: new Date().toISOString()
      });

      console.log(`   👉 Composers: ${composers.join(", ") || "None"}`);
      console.log(`   👉 Lyricists: ${lyricists.join(", ") || "None"}`);
      processedCount++;

    } catch (e) {
      console.error(`   ❌ Error processing track ${track.id}:`, e);
    }

    await sleep(800); // Politeness delay
  }

  console.log(`🎉 Finished credits parsing! Processed ${processedCount} tracks successfully.`);
  process.exit(0);
}

run().catch(console.error);
