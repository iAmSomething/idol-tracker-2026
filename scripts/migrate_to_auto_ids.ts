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

function isHashId(id: string): boolean {
  // Typical firestore auto-id is 20 chars, mixed case, alphanumeric
  return id.length === 20 && /^[a-zA-Z0-9]+$/.test(id);
}

async function run() {
  console.log("🚀 Starting Universal Auto-ID Migration...");

  const artistSnap = await getDocs(collection(db, "artists"));
  const agenciesSnap = await getDocs(collection(db, "agencies"));
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const tracksSnap = await getDocs(collection(db, "tracks"));
  const pendingReviewsSnap = await getDocs(collection(db, "pending_reviews"));

  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const agencies = agenciesSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const comebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const tracks = tracksSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const pendingReviews = pendingReviewsSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));

  console.log(`Loaded ${agencies.length} agencies, ${artists.length} artists, ${comebacks.length} comebacks.`);

  const agencyIdMap: { [oldId: string]: string } = {}; // oldId -> newAutoId
  const artistIdMap: { [oldId: string]: string } = {}; // oldId -> newAutoId

  let batch = writeBatch(db);
  let opCount = 0;

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  async function commitBatch() {
    if (opCount > 0) {
      await delay(1000); // 1초 지연 추가 (대역폭 제한 방어)
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  // 1. Map and migrate Agencies
  for (const agency of agencies) {
    let newId = agency.docId;
    if (!isHashId(agency.docId)) {
      const newRef = doc(collection(db, "agencies"));
      newId = newRef.id;
      agencyIdMap[agency.docId] = newId;

      const newData = { ...agency };
      delete newData.docId;
      newData.id = newId; // agency also stores id inside the document sometimes
      
      batch.set(newRef, newData);
      batch.delete(doc(db, "agencies", agency.docId));
      opCount += 2;
    }
  }
  console.log(`Mapped ${Object.keys(agencyIdMap).length} agencies to new IDs.`);
  await commitBatch();

  // 2. Map and migrate Artists
  for (const artist of artists) {
    let newId = artist.docId;
    if (!isHashId(artist.docId)) {
      const newRef = doc(collection(db, "artists"));
      newId = newRef.id;
      artistIdMap[artist.docId] = newId;

      const newData = { ...artist };
      delete newData.docId;
      
      // Update internal relations inside Artist
      if (newData.agencyId && agencyIdMap[newData.agencyId]) {
        newData.agencyId = agencyIdMap[newData.agencyId];
      }
      if (newData.agency && newData.agency.id && agencyIdMap[newData.agency.id]) {
        newData.agency.id = agencyIdMap[newData.agency.id];
      }
      // parentGroupId handles self or other artists, will update on second pass if needed, 
      // but let's just do it directly if already mapped
      if (newData.parentGroupId && artistIdMap[newData.parentGroupId]) {
        newData.parentGroupId = artistIdMap[newData.parentGroupId];
      }

      batch.set(newRef, newData);
      batch.delete(doc(db, "artists", artist.docId));
      opCount += 2;
      
      if (opCount >= 400) await commitBatch();
    } else {
      // It IS a hash ID, but might have outdated relations internally
      let needsUpdate = false;
      const updateData: any = {};
      
      if (artist.agencyId && agencyIdMap[artist.agencyId]) {
        updateData.agencyId = agencyIdMap[artist.agencyId];
        needsUpdate = true;
      }
      if (artist.agency && artist.agency.id && agencyIdMap[artist.agency.id]) {
        updateData.agency = { ...artist.agency, id: agencyIdMap[artist.agency.id] };
        needsUpdate = true;
      }
      if (artist.parentGroupId && artistIdMap[artist.parentGroupId]) {
        updateData.parentGroupId = artistIdMap[artist.parentGroupId];
        needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(doc(db, "artists", artist.docId), updateData);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }
    }
  }
  
  // Two-pass for artists whose parentGroupId hasn't been mapped yet when they were processed
  for (const artist of artists) {
     if (artistIdMap[artist.docId]) {
       // It was newly created
       const newId = artistIdMap[artist.docId];
       if (artist.parentGroupId && artistIdMap[artist.parentGroupId]) {
          batch.update(doc(db, "artists", newId), { parentGroupId: artistIdMap[artist.parentGroupId] });
          opCount++;
       }
     }
  }
  await commitBatch();

  console.log(`Mapped ${Object.keys(artistIdMap).length} artists to new IDs.`);

  // 3. Update relations in Agencies
  const allAgenciesSnap = await getDocs(collection(db, "agencies"));
  for (const aDoc of allAgenciesSnap.docs) {
    const agencyData = aDoc.data();
    if (agencyData.artistIds && Array.isArray(agencyData.artistIds)) {
      let changed = false;
      const newArtistIds = agencyData.artistIds.map((id: string) => {
        if (artistIdMap[id]) {
          changed = true;
          return artistIdMap[id];
        }
        return id;
      });

      if (changed) {
        batch.update(doc(db, "agencies", aDoc.id), { artistIds: Array.from(new Set(newArtistIds)) });
        opCount++;
        if (opCount >= 400) await commitBatch();
      }
    }
  }
  await commitBatch();

  // 4. Update Comebacks
  for (const cb of comebacks) {
    let changed = false;
    const updates: any = {};
    if (cb.artistId && artistIdMap[cb.artistId]) {
      updates.artistId = artistIdMap[cb.artistId];
      changed = true;
    }
    if (cb.agencyId && agencyIdMap[cb.agencyId]) {
      updates.agencyId = agencyIdMap[cb.agencyId];
      changed = true;
    }
    if (changed) {
      batch.update(doc(db, "comebacks", cb.docId), updates);
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }

  // 5. Update Tracks
  for (const tr of tracks) {
    if (tr.artistId && artistIdMap[tr.artistId]) {
      batch.update(doc(db, "tracks", tr.docId), { artistId: artistIdMap[tr.artistId] });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }

  // 6. Update Pending Reviews
  for (const pr of pendingReviews) {
    if (pr.artistId && artistIdMap[pr.artistId]) {
      batch.update(doc(db, "pending_reviews", pr.docId), { artistId: artistIdMap[pr.artistId] });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }

  await commitBatch();
  console.log("🎉 Universal ID Migration Complete!");
  process.exit(0);
}

run().catch(e => {
  console.error("Migration Failed", e);
  process.exit(1);
});
