import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(collection(db, "artists"));
  const agencies = new Set();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.agency?.name) agencies.add(data.agency.name);
  });
  console.log(`Found ${agencies.size} unique agencies.`);
  console.log(Array.from(agencies).slice(0, 20));
}
run();
