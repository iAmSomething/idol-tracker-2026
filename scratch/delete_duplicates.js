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
  const snapshot = await getDocs(collection(db, 'artists'));
  let count = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    // Delete artists that were accidentally created today by the buggy script
    if (data.type === 'unknown' && data.createdAt && data.createdAt.startsWith('2026-07-10T12:')) {
      console.log(`Deleting duplicate artist: ${data.name}`);
      await deleteDoc(doc(db, 'artists', d.id));
      count++;
    }
  }
  console.log(`Deleted ${count} duplicate artists.`);
  process.exit(0);
}
run();
