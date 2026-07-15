import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

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

async function run() {
  const q = query(
    collection(db, 'comebacks'),
    where('releaseDate', '==', '2026-07-10')
  );
  const snap = await getDocs(q);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.artistName === '연준' || data.artistName === 'SM') {
      console.log(`[${docSnap.id}] ${data.artistName} - ${data.title} (artistId: ${data.artistId})`);
    }
  });
}

run().catch(console.error);
