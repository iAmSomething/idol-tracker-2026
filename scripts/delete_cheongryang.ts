import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
  console.log("🧹 Cleaning up '청량' artist and related data...");

  // 1. Find all tracks for comeback PnGbQzO7N4oLmhHevTuA (청량's RUN TO YOU)
  const tracksQ = query(collection(db, "tracks"), where("comebackId", "==", "PnGbQzO7N4oLmhHevTuA"));
  const tracksSnap = await getDocs(tracksQ);
  console.log(`Found ${tracksSnap.size} tracks to delete.`);
  for (const d of tracksSnap.docs) {
    await deleteDoc(doc(db, "tracks", d.id));
    console.log(`- Deleted track: ${d.id}`);
  }

  // 2. Delete the comeback
  console.log("Deleting comeback PnGbQzO7N4oLmhHevTuA...");
  await deleteDoc(doc(db, "comebacks", "PnGbQzO7N4oLmhHevTuA"));

  // 3. Delete the artist '청량'
  console.log("Deleting artist '청량'...");
  await deleteDoc(doc(db, "artists", "청량"));

  console.log("✅ Cleanup complete!");
  process.exit(0);
}

run().catch(console.error);
