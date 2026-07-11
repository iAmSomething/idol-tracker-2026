import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(query(collection(db, "artists"), limit(5)));
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`Artist: ${data.name?.en || data.name?.ko}`, JSON.stringify(data.agency, null, 2));
  });
}
run();
