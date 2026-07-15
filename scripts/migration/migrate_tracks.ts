import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, query, getDoc, setDoc, deleteField } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function run() {
  console.log("🚀 Starting Tracks & Agency Artist Migration...");
  
  // 1. Update Agencies with artistIds
  console.log("1️⃣ Updating Agencies...");
  const artistSnap = await getDocs(collection(db, "artists"));
  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  
  const agencyArtistsMap: any = {}; // agencyId -> artistId[]
  for (const artist of artists) {
    if (artist.agencyId) {
      if (!agencyArtistsMap[artist.agencyId]) agencyArtistsMap[artist.agencyId] = [];
      agencyArtistsMap[artist.agencyId].push(artist.docId);
    }
  }

  let batch = writeBatch(db);
  let opCount = 0;
  
  for (const [agencyId, artistIds] of Object.entries(agencyArtistsMap)) {
    batch.update(doc(db, "agencies", agencyId), { artistIds });
    opCount++;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  if (opCount > 0) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }
  console.log("✅ Agencies updated with artistIds!");

  // 2. Migrate Tracks
  console.log("2️⃣ Migrating Tracks...");
  const comebackSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebackSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));
  
  for (const comeback of comebacks) {
    if (!comeback.tracks || !Array.isArray(comeback.tracks)) continue;
    
    // For each track, create a Track document
    for (let i = 0; i < comeback.tracks.length; i++) {
      const track = comeback.tracks[i];
      const trackId = `${comeback.docId}-track-${i}`;
      
      const trackDoc = {
        id: trackId,
        comebackId: comeback.docId,
        artistId: comeback.artistId || "",
        name: track.name || `Track ${i+1}`,
        isTitle: track.isTitle || false,
        duration: track.duration || null,
        musicVideoUrl: null, // to be populated
        streamingLinks: track.streamingLinks || {}
      };
      
      batch.set(doc(db, "tracks", trackId), trackDoc);
      opCount++;
      
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
    
    // Remove tracks array from comeback document
    batch.update(doc(db, "comebacks", comeback.docId), {
      tracks: deleteField()
    });
    opCount++;
    
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  
  if (opCount > 0) {
    await batch.commit();
  }
  
  console.log("🎉 Tracks Migration Complete!");
}

run().catch(console.error);
