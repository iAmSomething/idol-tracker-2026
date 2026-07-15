import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();
const app = initializeApp({
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc5147da03ef769e59",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
});
const db = getFirestore(app);
async function run() {
  const rootTracks = await getDocs(query(collection(db, 'tracks'), limit(1)));
  console.log(`Root tracks size: ${rootTracks.size}`);
  const q = query(collection(db, "comebacks"), where("releaseDate", "==", "2026-07-13"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const subTracks = await getDocs(collection(db, `comebacks/${d.id}/tracks`));
    console.log(`Sub tracks for ${d.id}: ${subTracks.size}`);
  }
  process.exit(0);
}
run();
