import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
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

async function fetchOfficialYoutube() {
  console.log("🌐 Fetching Official YouTube Channels for artists...");
  
  const snapshot = await getDocs(collection(db, "artists"));
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  // Filter out those who already have youtube links or are UNKNOWN
  const needsUpdate = artists.filter(a => 
    !a.id.startsWith("UNKNOWN_") && 
    (!a.socialLinks?.youtube)
  );
  
  console.log(`Found ${needsUpdate.length} artists requiring YouTube Channel resolution.`);
  
  let batch = writeBatch(db);
  let updateCount = 0;
  
  for (let i = 0; i < needsUpdate.length; i++) {
    const artist = needsUpdate[i];
    const artistName = artist.name.ko || artist.name.en;
    console.log(`[${i+1}/${needsUpdate.length}] Searching YT Channel for: ${artistName}`);
    
    try {
      const r = await ytSearch(`${artistName} official channel`);
      const channel = r.channels[0];
      
      if (channel) {
         console.log(`  👉 Found: ${channel.name} (${channel.url})`);
         const socialLinks = artist.socialLinks || {};
         socialLinks.youtube = channel.url;
         
         batch.update(doc(db, "artists", artist.id), {
           socialLinks: socialLinks,
           profileImageUrl: artist.profileImageUrl || channel.image // Bonus: get their profile pic!
         });
         updateCount++;
      } else {
         console.log(`  ❌ No channel found.`);
      }
    } catch (e) {
      console.error(`  ❌ Error searching for ${artistName}:`, e);
    }
    
    if (updateCount > 0 && updateCount % 100 === 0) {
       await batch.commit();
       batch = writeBatch(db);
       console.log(`... Committed ${updateCount} updates ...`);
    }
    
    // Sleep to avoid rate limiting
    await sleep(1000);
  }
  
  if (updateCount % 100 !== 0) {
      await batch.commit();
  }
  
  console.log(`✅ Finished! Updated YouTube links for ${updateCount} artists.`);
}

fetchOfficialYoutube().catch(console.error);
