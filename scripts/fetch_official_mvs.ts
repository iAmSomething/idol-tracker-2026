import dotenv from 'dotenv';
dotenv.config();
import { db } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import ytSearch from 'yt-search';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOfficialMVs() {
  logger.info("🎬 Fetching Official MVs for missing links (Cost Optimized)...");
  
  // 1. Fetch only comebacks released in the last 180 days + future comebacks
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 180);
  const dateLimitStr = dateLimit.toISOString().split('T')[0];

  logger.info(`Querying comebacks released on or after ${dateLimitStr}...`);
  const comebacksQuery = query(
    collection(db, "comebacks"), 
    where("releaseDate", ">=", dateLimitStr)
  );
  
  const snapshot = await getDocs(comebacksQuery);
  const comebacks = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  // Find ones that have no music video or only have the search query fallback
  const needsUpdate = comebacks.filter(c => 
    !c.mediaLinks?.musicVideo || c.mediaLinks.musicVideo.includes("results?search_query=")
  );
  
  logger.info(`Found ${needsUpdate.length} comebacks requiring YouTube MV resolution.`);
  
  let batch = writeBatch(db);
  let updateCount = 0;
  
  for (let i = 0; i < needsUpdate.length; i++) {
    const cb = needsUpdate[i];
    
    let queryStr = "";
    if (cb.mediaLinks?.musicVideo?.includes("results?search_query=")) {
      try {
          const urlParams = new URLSearchParams(cb.mediaLinks.musicVideo.split('?')[1]);
          queryStr = urlParams.get('search_query') || `${cb.artistName} ${cb.title} MV official`;
      } catch {
          queryStr = `${cb.artistName} ${cb.title} MV official`;
      }
    } else {
      queryStr = `${cb.artistName} ${cb.title} MV official`;
    }
    
    if (!queryStr.toLowerCase().includes("mv")) queryStr += " MV";
    
    logger.info(`[${i+1}/${needsUpdate.length}] Searching: ${queryStr}`);
    
    try {
      const r = await ytSearch(queryStr);
      const videos = r.videos;
      if (videos.length > 0) {
        const topVideoUrl = videos[0].url;
        logger.info(`  👉 Found: ${videos[0].title} (${topVideoUrl})`);
        
        batch.update(doc(db, "comebacks", cb.id), {
          "mediaLinks.musicVideo": topVideoUrl
        });
        
        updateCount++;
      } else {
         logger.warn(`  ❌ No videos found for: ${queryStr}`);
      }
    } catch (e) {
      logger.error(`  ❌ Error searching for ${queryStr}:`, e);
    }
    
    if (updateCount > 0 && updateCount % 200 === 0) {
       await batch.commit();
       batch = writeBatch(db);
       logger.info(`... Committed ${updateCount} MV updates ...`);
    }
    
    await sleep(200);
  }
  
  if (updateCount % 200 !== 0) {
      await batch.commit();
  }
  
  logger.info(`Finished! Replaced ${updateCount} search links with official MV URLs.`);
}

fetchOfficialMVs().catch(e => {
  logger.error("Fetch Official MVs Critical Failure:", e);
  process.exit(1);
});
