import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';

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
  const comebacksRef = collection(db, 'comebacks');
  const q = query(comebacksRef, where('artistName', '==', 'aespa'));
  const snapshot = await getDocs(q);

  let toDelete = 0;
  const batch = writeBatch(db);
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.releaseDate === '2026-07-14') {
        console.log(`Deleting: ${data.title} - ${data.releaseDate}`);
        batch.delete(docSnap.ref);
        toDelete++;
    }
  }
  
  if (toDelete > 0) {
      await batch.commit();
      console.log(`Deleted ${toDelete} documents.`);
  } else {
      console.log('No documents found to delete.');
  }
}
run();
