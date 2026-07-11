import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("🚀 Starting Track Deduplication...");

  const tracksSnap = await getDocs(collection(db, "tracks"));
  const tracks = tracksSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));

  console.log(`Loaded ${tracks.length} tracks.`);

  const tracksByComeback = new Map<string, any[]>();
  for (const t of tracks) {
    if (!tracksByComeback.has(t.comebackId)) {
      tracksByComeback.set(t.comebackId, []);
    }
    tracksByComeback.get(t.comebackId)!.push(t);
  }

  let batch = writeBatch(db);
  let opCount = 0;
  let deletedCount = 0;

  async function commitBatch() {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  for (const [comebackId, comebackTracks] of tracksByComeback.entries()) {
    // Group tracks by normalized name
    const tracksByName = new Map<string, any[]>();
    for (const t of comebackTracks) {
      const nameKey = (t.name || "").trim().toLowerCase();
      if (!tracksByName.has(nameKey)) {
        tracksByName.set(nameKey, []);
      }
      tracksByName.get(nameKey)!.push(t);
    }

    for (const [nameKey, duplicateGroup] of tracksByName.entries()) {
      if (duplicateGroup.length > 1) {
        // Sort to keep the "best" track.
        // Best = has bugs link > has composers > has order
        duplicateGroup.sort((a, b) => {
          const aScore = (a.streamingLinks?.bugs ? 10 : 0) + (a.composers?.length ? 5 : 0) + (a.order !== undefined ? 1 : 0);
          const bScore = (b.streamingLinks?.bugs ? 10 : 0) + (b.composers?.length ? 5 : 0) + (b.order !== undefined ? 1 : 0);
          return bScore - aScore; // Descending order
        });

        const bestTrack = duplicateGroup[0];
        const duplicatesToDelete = duplicateGroup.slice(1);

        for (const dup of duplicatesToDelete) {
          console.log(`Deleting duplicate track: ${dup.name} (${dup.docId}) from comeback ${comebackId}`);
          batch.delete(doc(db, "tracks", dup.docId));
          opCount++;
          deletedCount++;

          if (opCount >= 400) {
            await commitBatch();
          }
        }
      }
    }
  }

  await commitBatch();
  console.log(`🎉 Track Deduplication Complete! Deleted ${deletedCount} duplicate tracks.`);
  process.exit(0);
}

run().catch(e => {
  console.error("Track Deduplication Failed", e);
  process.exit(1);
});
