import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchBugsArtistInfo(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    // Get first artist link
    const detailUrl = $search('figure.artistInfo a.thumbnail').first().attr('href');
    if (!detailUrl) return null;

    const detailRes = await axios.get(detailUrl, { timeout: 5000 });
    const $detail = cheerio.load(detailRes.data);
    const artistTypeStr = $detail('table.info tbody tr').text().replace(/\s+/g, ' ');
    // Example: "솔로 (여성)" or "그룹 (혼성)"
    
    let gender: "male" | "female" | "mixed" | undefined;
    if (artistTypeStr.includes('(여성)')) gender = 'female';
    else if (artistTypeStr.includes('(남성)')) gender = 'male';
    else if (artistTypeStr.includes('(혼성)')) gender = 'mixed';
    
    return { gender };
  } catch (e: any) {
    console.error(`  [!] Error fetching ${artistName}: ${e.message}`);
    return null;
  }
}

async function scrapeMetadata() {
  console.log("🚀 Starting web scraping for artist metadata (Bugs Music)...");
  
  const artistsSnapshot = await getDocs(collection(db, "artists"));
  const artists = artistsSnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  // 1. Build Group Name -> ID map for parentGroupId matching
  const groupMap = new Map<string, string>();
  artists.forEach(a => {
    if (a.type === 'group') {
      groupMap.set(a.name.ko, a.id);
      if (a.name.en) groupMap.set(a.name.en, a.id);
      (a.name.aliases || []).forEach((alias: string) => groupMap.set(alias, a.id));
    }
  });

  let batch = writeBatch(db);
  let updateCount = 0;
  
  console.log(`Loaded ${artists.length} artists. Processing in batches...`);
  
  // Process sequentially to avoid rate limiting
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    let needsUpdate = false;
    const updates: any = {};

    // 1. Parent Group ID mapping
    if ((artist.type === 'solo' || artist.type === 'unit') && artist.parentGroup && !artist.parentGroupId) {
      const parentId = groupMap.get(artist.parentGroup);
      if (parentId) {
        updates.parentGroupId = parentId;
        needsUpdate = true;
      }
    }

    // 2. Gender Scraping
    if (!artist.gender) {
      console.log(`[${i+1}/${artists.length}] Scraping: ${artist.name.ko}...`);
      const info = await fetchBugsArtistInfo(artist.name.ko);
      if (info && info.gender) {
        updates.gender = info.gender;
        needsUpdate = true;
      }
      await delay(200); // polite delay
    }

    if (needsUpdate) {
      batch.update(doc(db, "artists", artist.id), updates);
      updateCount++;
      
      // Cascade to comebacks
      const comebackUpdates: any = {};
      if (updates.gender) comebackUpdates.artistGender = updates.gender;
      if (updates.parentGroupId) {
        comebackUpdates.parentGroupId = updates.parentGroupId;
        comebackUpdates.parentGroupName = artist.parentGroup;
      }
      
      if (Object.keys(comebackUpdates).length > 0) {
        const comebacksQuery = await getDocs(collection(db, "comebacks"));
        comebacksQuery.docs.forEach(cDoc => {
          if (cDoc.data().artistId === artist.id) {
            batch.update(doc(db, "comebacks", cDoc.id), comebackUpdates);
            updateCount++;
          }
        });
      }

      if (updateCount > 200) {
        await batch.commit();
        batch = writeBatch(db);
        updateCount = 0;
        console.log(`... Committed batch ...`);
      }
    }
  }

  if (updateCount > 0) {
    await batch.commit();
  }
  
  console.log("✅ Scraping and Migration Completed!");
  process.exit(0);
}

scrapeMetadata().catch(console.error);
