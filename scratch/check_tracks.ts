import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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
  const q = query(collection(db, "tracks"), where("comebackId", "==", "9YKFmDUR9IxL52VQhIaQ"));
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} tracks for 손준형`);
  for (const d of snap.docs) {
    console.log(d.data());
  }
  process.exit(0);
}
run();
