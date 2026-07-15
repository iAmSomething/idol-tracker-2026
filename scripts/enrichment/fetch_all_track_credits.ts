import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, limit } from 'firebase/firestore';
import * as cheerio from 'cheerio';
import { logger } from './lib/logger';

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
  logger.info("Starting Full Track Credits Parser...");

  // Fetch ALL tracks
  logger.info("Fetching all tracks from Firestore...");
  const tracksSnap = await getDocs(collection(db, "tracks"));
  const tracks = tracksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  logger.info(`Loaded ${tracks.length} total tracks.`);

  // Filter tracks that need parsing
  // Condition: Has bugs link AND has no composers AND no lyricists
  const targets = tracks.filter(t => 
    t.streamingLinks?.bugs && 
    (!t.composers || t.composers.length === 0)
  );

  logger.info(`Found ${targets.length} tracks requiring credits enrichment.`);
  
  // To avoid running indefinitely if there are thousands, let's limit to 1000 per run.
  const toProcess = targets.slice(0, 1000);
  let processedCount = 0;

  for (const track of toProcess) {
    const bugsUrl = track.streamingLinks.bugs;
    const trackIdMatch = bugsUrl.match(/\/track\/(\d+)/);
    if (!trackIdMatch) continue;
    const trackId = trackIdMatch[1];

    logger.info(`[${processedCount + 1}/${toProcess.length}] Fetching credits for track: "${track.name}" (${track.id})`);
    
    try {
      const res = await fetch(`https://music.bugs.co.kr/track/${trackId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) {
        logger.warn(`   -> Failed to fetch page. Status: ${res.status}`);
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

      // update doc
      await updateDoc(doc(db, "tracks", track.id), {
        composers,
        lyricists,
        updatedAt: new Date().toISOString()
      });

      logger.info(`   👉 Composers: ${composers.join(", ") || "None"}`);
      logger.info(`   👉 Lyricists: ${lyricists.join(", ") || "None"}`);
      processedCount++;

    } catch (e: any) {
      if (e.code === 'not-found') {
        logger.warn(`   ❌ Track ${track.id} not found in DB (might have been deleted).`);
      } else {
        logger.error(`   ❌ Error processing track ${track.id}:`, e);
      }
    }

    await sleep(800); // Politeness delay to avoid getting blocked
  }

  logger.info(`Finished credits parsing! Processed ${processedCount} tracks successfully.`);
  process.exit(0);
}

run().catch(e => {
  logger.error("Track Credits Parser Critical Failure:", e);
  process.exit(1);
});
