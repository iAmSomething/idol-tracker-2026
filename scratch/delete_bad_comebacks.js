import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  let deleted = 0;
  for (const c of comebacksSnap.docs) {
    const data = c.data();
    // Delete ones that have 'date' field instead of 'releaseDate'
    // OR have 'status: ANNOUNCED' and missing 'releaseDate'
    if (data.date && !data.releaseDate) {
      console.log(`Deleting bad comeback doc: ${c.id} - ${data.artistName}`);
      await deleteDoc(doc(db, 'comebacks', c.id));
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} bad comebacks.`);
  process.exit(0);
}

run();
