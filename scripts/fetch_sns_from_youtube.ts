import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

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

async function fetchYoutubeLinks(channelUrl: string) {
  try {
    const res = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!res.ok) return null;
    
    const data = await res.text();
    
    const igMatch = data.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.-]+)/g);
    const twMatch = data.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)/g);
    const weverseMatch = data.match(/https?:\/\/(?:www\.)?weverse\.io\/[a-zA-Z0-9_.-]+/g);
    const tiktokMatch = data.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)/g);
    
    return {
      instagram: igMatch ? [...new Set(igMatch)][0] : null,
      x: twMatch ? [...new Set(twMatch)][0] : null,
      weverse: weverseMatch ? [...new Set(weverseMatch)][0] : null,
      tiktok: tiktokMatch ? [...new Set(tiktokMatch)][0] : null,
    };
  } catch (err) {
    console.error(`Error fetching YouTube for ${channelUrl}:`, err);
    return null;
  }
}

async function run() {
  console.log("🚀 Starting SNS Fetch from YouTube...");
  const artistSnap = await getDocs(collection(db, "artists"));
  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  
  let batch = writeBatch(db);
  let opCount = 0;
  
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const artistName = artist.name.en || artist.name.ko;
    const ytUrl = artist.socialLinks?.youtube;
    
    if (!ytUrl || artistName.includes("UNKNOWN")) continue;
    
    // Skip if we already have x and instagram and weverse
    if (artist.socialLinks?.x && artist.socialLinks?.instagram && artist.socialLinks?.weverse) {
       continue;
    }
    
    console.log(`[${i+1}/${artists.length}] YouTube Check: ${artistName}`);
    
    const snsData = await fetchYoutubeLinks(ytUrl);
    if (snsData && (snsData.x || snsData.instagram || snsData.tiktok || snsData.weverse)) {
       console.log(`  👉 Found: X=${!!snsData.x}, IG=${!!snsData.instagram}, TikTok=${!!snsData.tiktok}, Weverse=${!!snsData.weverse}`);
       
       const socialLinks = artist.socialLinks || {};
       if (snsData.x && !socialLinks.x) socialLinks.x = snsData.x.replace('twitter.com', 'x.com');
       if (snsData.instagram && !socialLinks.instagram) socialLinks.instagram = snsData.instagram;
       if (snsData.tiktok && !socialLinks.tiktok) socialLinks.tiktok = snsData.tiktok;
       if (snsData.weverse && !socialLinks.weverse) socialLinks.weverse = snsData.weverse;
       
       batch.update(doc(db, "artists", artist.docId), {
         socialLinks
       });
       
       opCount++;
    } else {
       console.log(`  ❌ No new links found.`);
    }
    
    if (opCount > 0 && opCount % 50 === 0) {
      await batch.commit();
      batch = writeBatch(db);
      console.log(`... Committed ${opCount} updates ...`);
    }
    
    await sleep(200); // 200ms is enough for raw HTML fetch if it's youtube, they don't rate limit IP as easily for normal pages
  }
  
  if (opCount % 50 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Finished! Updated SNS links for ${opCount} artists from YouTube.`);
}

run().catch(console.error);
