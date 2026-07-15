import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc, deleteField } from 'firebase/firestore';
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

// Simple similarity check
function isSameComeback(dbCb: any, bugsCb: any) {
  if (dbCb.releaseDate !== bugsCb.releaseDate) return false;
  if (!dbCb.title || !bugsCb.title || !dbCb.artistName || !bugsCb.artistName) return false;
  
  // Title match
  const dbTitle = dbCb.title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const bugsTitle = bugsCb.title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  if (dbTitle && bugsTitle && (dbTitle.includes(bugsTitle) || bugsTitle.includes(dbTitle))) {
    return true;
  }

  // Artist match (very fuzzy for bugs since it includes English in parens)
  const dbArtist = dbCb.artistName.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const bugsArtist = bugsCb.artistName.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  if (dbArtist && bugsArtist && (dbArtist.includes(bugsArtist) || bugsArtist.includes(dbArtist))) {
    return true;
  }
  
  return false;
}

function isRemixOrVer(title: string) {
  const t = title.toLowerCase();
  return t.includes('remix') || t.includes('mix)') || t.includes('ver.') || t.includes('instrumental') || t.includes('inst.');
}

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
  
  dbSnap.forEach(d => {
    dbComebacks.set(d.id, { id: d.id, ...d.data() });
  });

  // Filter out bugs data that are remixes or instrumental (we don't want to insert them as new comebacks)
  const validBugsData = bugsData.filter((b: any) => !isRemixOrVer(b.title));

  console.log('=== 🔍 RECONCILIATION SCRIPT ===\n');

  let batch = writeBatch(db);
  let toDelete = 0;
  let toUpdate = 0;
  let toInsert = 0;

  // 1. Check DB comebacks against Bugs Data
  for (const [id, dbItem] of dbComebacks.entries()) {
    // Find matching Bugs comeback
    const bugsMatch = validBugsData.find((b: any) => isSameComeback(dbItem, b));

    if (bugsMatch) {
      // We found a match in Bugs! Let's enrich EVERYTHING we can.
      let updateData: any = {};
      let enriched = false;

      // Check if tracks collection already has documents for this comeback
      const tracksSnap = await getDocs(query(collection(db, 'tracks'), where('comebackId', '==', id)));
      const hasTracksInCollection = !tracksSnap.empty;

      if (dbItem.tracks) {
        // Delete the corrupted inline array from the comeback document
        updateData.tracks = deleteField();
        enriched = true;
      }

      if (!hasTracksInCollection && bugsMatch.tracks && bugsMatch.tracks.length > 0) {
        for (const t of bugsMatch.tracks) {
           const newTrackRef = doc(collection(db, 'tracks'));
           batch.set(newTrackRef, {
             name: t.title || t.name,
             trackNumber: t.trackNumber || 1,
             isTitle: t.isTitle || false,
             streamingLinks: t.streamingLinks || {},
             comebackId: id,
             createdAt: new Date().toISOString()
           });
        }
        updateData['streamingLinks.bugs'] = bugsMatch.tracks[0].streamingLinks?.bugs || "";
        enriched = true;
      }
      
      if (!dbItem.mediaLinks?.musicVideo && bugsMatch.musicVideoUrl) {
        updateData['mediaLinks.musicVideo'] = bugsMatch.musicVideoUrl;
        enriched = true;
      }

      if (!dbItem.albumCoverUrl && bugsMatch.imageUrl) {
        updateData.albumCoverUrl = bugsMatch.imageUrl;
        enriched = true;
      }

      if ((!dbItem.releaseType || dbItem.releaseType === 'ep') && bugsMatch.releaseType) {
        updateData.releaseType = bugsMatch.releaseType;
        enriched = true;
      }

      if ((!dbItem.agencyName || dbItem.agencyName === '미상') && bugsMatch.agency) {
        updateData.agencyName = bugsMatch.agency;
        enriched = true;
      }

      if (enriched) {
        console.log(`[UPDATE] Enriching comeback from Bugs for: ${dbItem.artistName} - ${dbItem.title}`);
        batch.update(doc(db, 'comebacks', id), updateData);
        toUpdate++;
      }
    } else {
      // Check if this is a known fake/mix comeback that needs to be deleted
      const isAespaRemix = dbItem.artistName === 'aespa' && dbItem.releaseDate === '2026-07-14' && 
                           (dbItem.title.toLowerCase().includes('mix') || dbItem.title.toLowerCase().includes('symphonic') || dbItem.title.includes('SYNK'));

      if (isAespaRemix) {
        console.log(`[DELETE] ${isAespaRemix ? 'Fake comeback (Mix Album)' : 'Fake comeback (No tracks, Not in Bugs)'}: ${dbItem.artistName} - ${dbItem.title} (${dbItem.releaseDate})`);
        batch.delete(doc(db, 'comebacks', id));
        toDelete++;
      }
    }
    
    // Mark as checked so we know what's left in bugs
    if (bugsMatch) {
      bugsMatch._matched = true;
    }
  }

  // 2. We don't automatically insert missed comebacks here because we need proper artistId mapping.
  // The daily/weekly crawler should have caught them. If it didn't, it might be due to missing aliases.
  // We will just log them for now so we can manually add aliases if needed.
  for (const bugsItem of validBugsData) {
    if (!bugsItem._matched && bugsItem.releaseDate >= startStr && bugsItem.releaseDate <= endStr) {
      console.log(`[WARNING] Missed comeback found in Bugs (Requires DB check): ${bugsItem.artistName} - ${bugsItem.title} (${bugsItem.releaseDate})`);
      toInsert++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`To Delete (Fake): ${toDelete}`);
  console.log(`To Update (Enrich): ${toUpdate}`);
  console.log(`Missed by Crawler: ${toInsert}`);
  
  if (process.argv.includes('--execute')) {
     await batch.commit();
     console.log('✅ Changes committed to database.');
  } else {
     console.log('⚠️ DRY RUN. Run with --execute to apply changes.');
  }
}

run().catch(console.error);
