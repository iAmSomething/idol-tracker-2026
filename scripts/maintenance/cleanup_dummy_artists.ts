import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc, writeBatch } from 'firebase/firestore';

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
  const batch = writeBatch(db);
  
  // 1. Delete dummy SM artist
  console.log("Deleting SM dummy artist GZO2TKnMRVXuZdtUNi43...");
  batch.delete(doc(db, 'artists', 'GZO2TKnMRVXuZdtUNi43'));
  
  // 2. Delete SM comebacks
  const smQuery = query(collection(db, 'comebacks'), where('artistId', '==', 'GZO2TKnMRVXuZdtUNi43'));
  const smSnap = await getDocs(smQuery);
  smSnap.forEach(d => {
    console.log(`Deleting SM comeback: ${d.id}`);
    batch.delete(doc(db, 'comebacks', d.id));
  });

  // 3. Delete Yeonjun hardcoded duplicate
  console.log("Deleting yeonjun_no_labels_part_02...");
  batch.delete(doc(db, 'comebacks', 'yeonjun_no_labels_part_02'));

  await batch.commit();
  console.log("Cleanup complete!");
}

run().catch(console.error);
