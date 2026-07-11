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

async function fetchWikidataSNS(artistName: string) {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&format=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`HTTP Error: ${searchRes.status} ${searchRes.statusText}`);
    const searchData = await searchRes.json();
    const id = searchData.search[0]?.id;
    
    if (!id) return null;
    
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${id}&format=json`;
    const entityRes = await fetch(entityUrl);
    if (!entityRes.ok) throw new Error(`HTTP Error: ${entityRes.status} ${entityRes.statusText}`);
    const entityData = await entityRes.json();
    const claims = entityData.claims;
    
    const twitter = claims['P2002']?.[0]?.mainsnak?.datavalue?.value;
    const instagram = claims['P2003']?.[0]?.mainsnak?.datavalue?.value;
    const tiktok = claims['P4003']?.[0]?.mainsnak?.datavalue?.value;
    
    return {
      twitter: twitter ? `https://x.com/${twitter}` : null,
      instagram: instagram ? `https://instagram.com/${instagram}` : null,
      tiktok: tiktok ? `https://tiktok.com/@${tiktok}` : null,
    };
  } catch (err) {
    console.error(`Error fetching Wikidata for ${artistName}:`, err);
    return null;
  }
}

async function run() {
  console.log("🚀 Starting Full SNS Fetch using Wikidata...");
  const artistSnap = await getDocs(collection(db, "artists"));
  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  
  let batch = writeBatch(db);
  let opCount = 0;
  
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const artistName = artist.name.en || artist.name.ko;
    
    if (artistName.includes("UNKNOWN")) continue;
    
    // Skip if we already have both x and instagram
    if (artist.socialLinks?.x && artist.socialLinks?.instagram) {
       continue;
    }
    
    // Strip everything after the first parenthesis
    const cleanName = artistName.split('(')[0].trim();
    
    console.log(`[${i+1}/${artists.length}] Wikidata Search: ${cleanName} (Original: ${artistName})`);
    
    const snsData = await fetchWikidataSNS(cleanName);
    if (snsData && (snsData.twitter || snsData.instagram || snsData.tiktok)) {
       console.log(`  👉 Found: X=${!!snsData.twitter}, IG=${!!snsData.instagram}`);
       
       const socialLinks = artist.socialLinks || {};
       if (snsData.twitter) socialLinks.x = snsData.twitter;
       if (snsData.instagram) socialLinks.instagram = snsData.instagram;
       if (snsData.tiktok) socialLinks.tiktok = snsData.tiktok;
       
       batch.update(doc(db, "artists", artist.docId), {
         socialLinks
       });
       
       opCount++;
    } else {
       console.log(`  ❌ No data found.`);
    }
    
    if (opCount > 0 && opCount % 100 === 0) {
      await batch.commit();
      batch = writeBatch(db);
      console.log(`... Committed ${opCount} updates ...`);
    }
    
    await sleep(2500); // Be nice to Wikidata API
  }
  
  if (opCount % 100 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Finished! Updated SNS links for ${opCount} artists.`);
}

run().catch(console.error);
