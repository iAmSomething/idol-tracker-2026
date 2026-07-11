import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import ytSearch from 'yt-search';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com",
  messagingSenderId: "47996752520"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOfficialMVs() {
  console.log("🎬 Fetching Official MVs for missing links (Cost Optimized)...");
  
  // 1. Fetch only comebacks released in the last 180 days + future comebacks
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 180);
  const dateLimitStr = dateLimit.toISOString().split('T')[0];

  console.log(`Querying comebacks released on or after ${dateLimitStr}...`);
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
  
  console.log(`Found ${needsUpdate.length} comebacks requiring YouTube MV resolution.`);
  
  let batch = writeBatch(db);
  let updateCount = 0;
  
  for (let i = 0; i < needsUpdate.length; i++) {
    const cb = needsUpdate[i];
    
    // Construct query using album title if we don't have the search query
    let queryStr = "";
    if (cb.mediaLinks?.musicVideo?.includes("results?search_query=")) {
      try {
          const urlParams = new URLSearchParams(cb.mediaLinks.musicVideo.split('?')[1]);
          queryStr = urlParams.get('search_query') || `${cb.artistName} ${cb.title} MV official`;
      } catch {
          queryStr = `${cb.artistName} ${cb.title} MV official`;
      }
    } else {
      // Use album title as fallback for the MV search
      queryStr = `${cb.artistName} ${cb.title} MV official`;
    }
    
    // Add "MV" or "official" if not present to ensure we get music videos
    if (!queryStr.toLowerCase().includes("mv")) queryStr += " MV";
    
    console.log(`[${i+1}/${needsUpdate.length}] Searching: ${queryStr}`);
    
    try {
      const r = await ytSearch(queryStr);
      const videos = r.videos;
      if (videos.length > 0) {
        // Take the top video link
        const topVideoUrl = videos[0].url;
        
        console.log(`  👉 Found: ${videos[0].title} (${topVideoUrl})`);
        
        batch.update(doc(db, "comebacks", cb.id), {
          "mediaLinks.musicVideo": topVideoUrl
        });
        
        updateCount++;
      } else {
         console.log(`  ❌ No videos found for: ${queryStr}`);
      }
    } catch (e) {
      console.error(`  ❌ Error searching for ${queryStr}:`, e);
    }
    
    // Commit every 200 updates
    if (updateCount > 0 && updateCount % 200 === 0) {
       await batch.commit();
       batch = writeBatch(db);
       console.log(`... Committed ${updateCount} MV updates ...`);
    }
    
    // Sleep to avoid rate limiting
    await sleep(200);
  }
  
  if (updateCount % 200 !== 0) {
      await batch.commit();
  }
  
  console.log(`✅ Finished! Replaced ${updateCount} search links with official MV URLs.`);
}

fetchOfficialMVs().catch(console.error);
