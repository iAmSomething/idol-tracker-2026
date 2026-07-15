import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import * as fs from 'fs';

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

async function run() {
  const bugsData = JSON.parse(fs.readFileSync('bugs_comeback_data.json', 'utf8'));
  
  const today = new Date('2026-07-15T00:00:00Z');
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startStr = sevenDaysAgo.toISOString().split('T')[0];
  const endStr = '2026-07-15';

  const q = query(
    collection(db, 'comebacks'),
    where('releaseDate', '>=', startStr),
    where('releaseDate', '<=', endStr)
  );
  
  const dbSnap = await getDocs(q);
  const dbComebacks = new Map<string, any>();
  const artistMap = new Map<string, string>(); // artistId -> artistName
  
  dbSnap.forEach(d => {
    const data = d.data();
    dbComebacks.set(d.id, { id: d.id, ...data });
    artistMap.set(data.artistId, data.artistName);
  });

  const bugsMap = new Map<string, any>();
  for (const item of bugsData) {
    if (item.releaseDate >= startStr && item.releaseDate <= endStr) {
      // Create a fuzzy key
      const key = `${item.artistName.toLowerCase().replace(/\s+/g, '')}_${item.releaseDate}`;
      // Group bugs data by key. (Taking the one with most tracks if duplicates)
      if (!bugsMap.has(key)) {
        bugsMap.set(key, item);
      } else {
        const existing = bugsMap.get(key);
        if ((item.tracks?.length || 0) > (existing.tracks?.length || 0)) {
          bugsMap.set(key, item);
        }
      }
    }
  }

  console.log('=== 🔍 DRY RUN RECONCILIATION ===\n');

  let toDelete = 0;
  let toUpdate = 0;
  let toInsert = 0;

  // 1. Check DB comebacks
  for (const [id, dbItem] of dbComebacks.entries()) {
    const hasTracks = dbItem.tracks && dbItem.tracks.length > 0;
    
    // Fuzzy key to find in bugs
    const key = `${dbItem.artistName.toLowerCase().replace(/\s+/g, '')}_${dbItem.releaseDate}`;
    const bugsMatch = bugsMap.get(key);

    if (!hasTracks) {
      if (bugsMatch) {
        console.log(`[UPDATE] Found tracks in Bugs for: ${dbItem.artistName} - ${dbItem.title}`);
        console.log(`         -> Will add ${bugsMatch.tracks.length} tracks and MV link.`);
        toUpdate++;
      } else {
        console.log(`[DELETE] Fake comeback (No tracks, Not in Bugs): ${dbItem.artistName} - ${dbItem.title} (${dbItem.releaseDate})`);
        toDelete++;
      }
    } else {
      // Has tracks, but check if we can enrich further (e.g. MV link missing)
      if (bugsMatch && !dbItem.mediaLinks?.musicVideo && bugsMatch.musicVideoUrl) {
         console.log(`[UPDATE] Adding MV link from Bugs for: ${dbItem.artistName} - ${dbItem.title}`);
         toUpdate++;
      }
    }
    
    // Mark as checked so we know what's left in bugs
    if (bugsMatch) {
      bugsMatch._matched = true;
    }
  }

  // 2. Check missed Bugs comebacks
  for (const [key, bugsItem] of bugsMap.entries()) {
    if (!bugsItem._matched) {
      // It's in bugs but not in DB
      // We should insert it
      console.log(`[INSERT] Missed comeback found in Bugs: ${bugsItem.artistName} - ${bugsItem.title} (${bugsItem.releaseDate})`);
      toInsert++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total DB records checked (last 7 days): ${dbComebacks.size}`);
  console.log(`Total Bugs records (last 7 days): ${bugsMap.size}`);
  console.log(`To Delete (Fake): ${toDelete}`);
  console.log(`To Update (Enrich): ${toUpdate}`);
  console.log(`To Insert (Missed): ${toInsert}`);
}

run().catch(console.error);
