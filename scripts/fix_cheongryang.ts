import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
  console.log("Searching for '청량'...");
  
  // 1. Find artist '청량'
  const artistsSnap = await getDocs(query(collection(db, "artists"), where("name.ko", "==", "청량")));
  if (artistsSnap.empty) {
    // If not found by ko name, let's just search the document id
    const artistDoc = await getDocs(query(collection(db, "artists")));
    const found = artistDoc.docs.find(d => d.id === "청량" || d.data().name?.ko === "청량");
    if (found) {
      console.log(`Found artist '청량' with ID: ${found.id}`);
    } else {
      console.log("Artist '청량' not found in db.");
      return;
    }
  } else {
    for (const d of artistsSnap.docs) {
      console.log(`Found artist '청량' with ID: ${d.id}`);
    }
  }

  // Let's also find the comeback "RUN TO YOU"
  const cbSnap = await getDocs(query(collection(db, "comebacks"), where("albumTitle", "==", "RUN TO YOU")));
  console.log(`Found ${cbSnap.size} comebacks named 'RUN TO YOU'`);
  for (const d of cbSnap.docs) {
    console.log(`- Comeback ID: ${d.id}, ArtistId: ${d.data().artistId}, ArtistName: ${d.data().artistName}`);
  }

  process.exit(0);
}

run().catch(console.error);
