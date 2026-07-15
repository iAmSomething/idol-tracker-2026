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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snapshot = await getDocs(collection(db, "comebacks"));
  const counts = new Map<string, string[]>();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.artistId || !data.releaseDate) return;
    const key = `${data.artistName} (${data.artistId}) - ${data.releaseDate}`;
    if (!counts.has(key)) counts.set(key, []);
    counts.get(key)!.push(`${doc.id}: ${data.title} (${data.releaseType})`);
  });
  
  for (const [key, titles] of counts.entries()) {
    if (titles.length > 1) {
      console.log(`Duplicate found for ${key}:`);
      titles.forEach(t => console.log(`  - ${t}`));
    }
  }
}
run();
