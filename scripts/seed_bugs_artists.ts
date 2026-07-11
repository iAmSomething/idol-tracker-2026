import dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

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

async function seedArtists() {
  console.log("Reading bugs_idol_master_data.json...");
  const dataPath = path.resolve(process.cwd(), 'bugs_idol_master_data.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const artists = JSON.parse(rawData);

  console.log(`Found ${artists.length} artists in JSON.`);

  console.log("Wiping existing artists collection to ensure clean update...");
  const existingDocs = await getDocs(collection(db, "artists"));
  let deletedCount = 0;
  for (const d of existingDocs.docs) {
    await deleteDoc(doc(db, "artists", d.id));
    deletedCount++;
  }
  console.log(`Wiped ${deletedCount} old artists.`);

  console.log("Inserting new master data...");
  let inserted = 0;
  for (const artist of artists) {
    const artistId = artist.name.en || artist.name.ko;
    const sanitizedId = artistId.replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    
    // Ensure all undefined fields are stripped or set to null
    const cleanArtist = JSON.parse(JSON.stringify(artist));

    await setDoc(doc(db, "artists", sanitizedId), cleanArtist);
    inserted++;
  }

  console.log(`Successfully inserted ${inserted} artists.`);
  process.exit(0);
}

seedArtists();
