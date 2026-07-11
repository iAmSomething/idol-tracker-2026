import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, deleteField } from 'firebase/firestore';
import * as cheerio from 'cheerio';
import ytSearch from 'yt-search';

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
  console.log("🚀 Starting Bugs Album Detail Scraper...");
  
  const snapshot = await getDocs(collection(db, "comebacks"));
  const comebacks = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log(`Found ${comebacks.length} comebacks to process.`);
  
  let batch = writeBatch(db);
  let updateCount = 0;
  
  for (let i = 0; i < comebacks.length; i++) {
    const cb = comebacks[i];
    console.log(`\n[${i+1}/${comebacks.length}] Processing: ${cb.artistName} - ${cb.albumTitle || cb.title}`);
    
    // Extract albumId
    const coverUrl = cb.albumCoverUrl || "";
    const match = coverUrl.match(/\/(\d+)\.jpg/);
    if (!match) {
      console.log(`  ❌ Could not extract albumId from ${coverUrl}`);
      continue;
    }
    const albumId = match[1];
    
    try {
      const res = await fetch(`https://music.bugs.co.kr/album/${albumId}`);
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const tracks: any[] = [];
      const titleTracks: any[] = [];
      
      $("table.list.trackList tbody tr[rowtype='track']").each((_, el) => {
        let title = $(el).find('p.title a').first().text().trim();
        if (!title) {
           title = $(el).find('p.title').text().trim(); // Fallback if no a tag
        }
        
        const isTitle = $(el).find('span.albumTitle').text().includes('타이틀곡');
        const mvid = $(el).attr('mvid');
        
        if (title) {
          tracks.push({
            name: title,
            isTitle,
            streamingLinks: {
              bugs: `https://music.bugs.co.kr/track/${$(el).attr('trackid')}`
            }
          });
          
          if (isTitle) {
            titleTracks.push({
               name: title,
               _mvid: mvid // temporary to hold bugs mv id
            });
          }
        }
      });
      
      const teasers: string[] = cb.mediaLinks?.teasers || [];
      
      for (const t of titleTracks) {
        // ALWAYS search YouTube for the MV or Teaser first
        let query = `${cb.artistName} ${t.name} MV official`;
        if (!cb.isCompleted) {
            query = `${cb.artistName} ${t.name} Teaser official`;
        }
        
        console.log(`  🔍 Searching YT: ${query}`);
        const r = await ytSearch(query);
        const video = r.videos[0];
        
        if (video) {
            if (!cb.isCompleted) {
                teasers.push(video.url);
                // Also search for MV just in case it was pre-released
                const mvQuery = `${cb.artistName} ${t.name} MV official`;
                const mvR = await ytSearch(mvQuery);
                const mvVideo = mvR.videos[0];
                if (mvVideo && !mvVideo.title.toLowerCase().includes("teaser")) {
                    t.musicVideoUrl = mvVideo.url;
                }
            } else {
                t.musicVideoUrl = video.url;
            }
        }
        
        // Fallback to Bugs mvid ONLY if we completely failed to get a YouTube MV and it exists
        if (!t.musicVideoUrl && t._mvid && t._mvid !== '0') {
            console.log(`  ⚠️ Falling back to Bugs MV for: ${t.name}`);
            t.musicVideoUrl = `https://music.bugs.co.kr/mv/${t._mvid}`;
        }
        
        delete t._mvid; // Clean up the temp variable
      }
      
      const mediaLinks = {
        teasers: [...new Set(teasers)] // Deduplicate
      };
      
      const streamingLinks = cb.streamingLinks || {};
      streamingLinks.bugs = `https://music.bugs.co.kr/album/${albumId}`;
      
      console.log(`  👉 Found ${tracks.length} tracks, ${titleTracks.length} title tracks`);
      
      batch.update(doc(db, "comebacks", cb.id), {
        albumTitle: cb.title || cb.albumTitle || "",
        title: deleteField(), // Remove old 'title'
        tracks,
        titleTracks,
        streamingLinks,
        mediaLinks
      });
      
      updateCount++;
      if (updateCount > 0 && updateCount % 50 === 0) {
         await batch.commit();
         batch = writeBatch(db);
         console.log(`... Committed ${updateCount} updates ...`);
      }
      
    } catch (e) {
      console.error(`  ❌ Error processing albumId ${albumId}:`, e);
    }
    
    await sleep(500); // 500ms delay to avoid overloading bugs or yt
  }
  
  if (updateCount % 50 !== 0) {
      await batch.commit();
  }
  
  console.log(`✅ Finished processing all ${updateCount} comebacks.`);
}

run().catch(console.error);
