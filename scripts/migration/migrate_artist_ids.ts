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

function isHashId(id: string): boolean {
  // Typical firestore auto-id is 20 chars, mixed case, alphanumeric
  return id.length === 20 && /^[a-zA-Z0-9]+$/.test(id);
}

function normalizeName(name: any): string {
  if (!name) return "";
  const nameStr = typeof name === 'object' ? (name.ko || name.en || "") : String(name);
  return nameStr.toLowerCase().replace(/[^a-z0-9가-힣]/g, "").trim();
}

async function run() {
  console.log("🚀 Starting Artist ID Normalization Migration...");

  const artistSnap = await getDocs(collection(db, "artists"));
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const tracksSnap = await getDocs(collection(db, "tracks"));
  const agenciesSnap = await getDocs(collection(db, "agencies"));

  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const comebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const tracks = tracksSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  const agencies = agenciesSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));

  console.log(`Loaded ${artists.length} artists, ${comebacks.length} comebacks, ${tracks.length} tracks, ${agencies.length} agencies.`);

  const mappings: { [oldId: string]: string } = {}; // oldId -> newCanonicalId

  let batch = writeBatch(db);
  let opCount = 0;

  async function commitBatch() {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  const existingCanonicalIds = new Set(artists.filter(a => !isHashId(a.docId)).map(a => a.docId));

  for (const artist of artists) {
    if (isHashId(artist.docId)) {
      const canonicalId = normalizeName(artist.name) || "unknown";
      mappings[artist.docId] = canonicalId;

      console.log(`Migrating artist: ${artist.docId} -> ${canonicalId} (${artist.name})`);

      if (!existingCanonicalIds.has(canonicalId)) {
        // Create new canonical artist document
        const newArtistData = { ...artist };
        delete newArtistData.docId;
        batch.set(doc(db, "artists", canonicalId), newArtistData);
        existingCanonicalIds.add(canonicalId);
        opCount++;
      } else {
        console.log(`  -> Canonical ID ${canonicalId} already exists. Merging/Skipping creation.`);
      }

      // Delete old hash ID document
      batch.delete(doc(db, "artists", artist.docId));
      opCount++;

      if (opCount >= 400) await commitBatch();
    }
  }

  console.log("✅ Artist documents migrated.");

  // Update comebacks
  for (const cb of comebacks) {
    if (mappings[cb.artistId]) {
      batch.update(doc(db, "comebacks", cb.docId), { artistId: mappings[cb.artistId] });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }
  console.log("✅ Comebacks updated.");

  // Update tracks
  for (const tr of tracks) {
    if (mappings[tr.artistId]) {
      batch.update(doc(db, "tracks", tr.docId), { artistId: mappings[tr.artistId] });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }
  console.log("✅ Tracks updated.");

  // Update agencies
  for (const agency of agencies) {
    if (agency.artistIds && Array.isArray(agency.artistIds)) {
      let changed = false;
      const newArtistIds = agency.artistIds.map((id: string) => {
        if (mappings[id]) {
          changed = true;
          return mappings[id];
        }
        return id;
      });

      if (changed) {
        batch.update(doc(db, "agencies", agency.docId), { artistIds: Array.from(new Set(newArtistIds)) });
        opCount++;
        if (opCount >= 400) await commitBatch();
      }
    }
  }
  console.log("✅ Agencies updated.");

  await commitBatch();
  console.log("🎉 Artist ID Migration Complete!");
  process.exit(0);
}

run().catch(e => {
  console.error("Migration Failed", e);
  process.exit(1);
});
