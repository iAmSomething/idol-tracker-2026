import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

async function uploadArtists() {
  const data = JSON.parse(fs.readFileSync('./artists_full.json', 'utf8'));
  console.log(`Uploading ${data.length} artists...`);

  for (const artist of data) {
    try {
      const docRef = doc(db, 'artists', artist.id);
      await setDoc(docRef, {
        generation: artist.generation,
        name: artist.name,
        type: artist.type,
        parentGroup: artist.parentGroup,
        members: artist.members || [],
        agency: artist.agency,
        isActive: artist.isActive,
        createdAt: serverTimestamp(),
      });
      console.log(`✅ Uploaded artist: ${artist.name.ko} (${artist.id})`);
    } catch (err) {
      console.error(`❌ Failed to upload artist ${artist.id}:`, err);
    }
  }

  console.log('Artist upload complete! Exiting...');
  process.exit(0);
}

uploadArtists();
