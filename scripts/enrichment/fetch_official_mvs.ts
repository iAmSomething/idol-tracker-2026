import dotenv from 'dotenv';
dotenv.config();
import { db } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { getRecentComebacks } from './lib/firebase-helpers';
import ytSearch from 'yt-search';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOfficialMVs() {
  logger.info("🎬 Fetching Official MVs for missing links (Cost Optimized)...");
  
  logger.info(`Querying recent comebacks...`);
  const comebacks = await getRecentComebacks(30);
  
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
        const topVideo = videos[0];
        const mvTitleClean = topVideo.title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
        
        let isValidMV = false;
        
        if (cb.tracks && cb.tracks.length > 0) {
            const titleTracks = cb.tracks.filter((t: any) => t.isTitle);
            
            // 1. Check title tracks first
            for (const t of titleTracks) {
                const trackClean = (t.title || t.name || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
                if (trackClean.length > 1 && mvTitleClean.includes(trackClean)) {
                    isValidMV = true; break;
                }
            }
            
            // 2. Check all other tracks if not found
            if (!isValidMV) {
                for (const t of cb.tracks) {
                    const trackClean = (t.title || t.name || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
                    if (trackClean.length > 1 && mvTitleClean.includes(trackClean)) {
                        isValidMV = true; break;
                    }
                }
            }
        } else {
            // Fallback: check album title
            const albumClean = cb.title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            if (albumClean.length > 1 && mvTitleClean.includes(albumClean)) {
                isValidMV = true;
            }
        }
        
        if (isValidMV) {
            logger.info(`  👉 Validated & Found: ${topVideo.title} (${topVideo.url})`);
            batch.update(doc(db, "comebacks", cb.id), {
              "mediaLinks.musicVideo": topVideo.url
            });
            updateCount++;
        } else {
            logger.warn(`  ❌ Found video but failed validation: ${topVideo.title} (Expected track match)`);
            // Optionally clear the search_query fallback
            batch.update(doc(db, "comebacks", cb.id), {
              "mediaLinks.musicVideo": ""
            });
            updateCount++;
        }
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
