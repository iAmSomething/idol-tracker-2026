import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc514f82846f3ec53d", storageBucket: "idol-tracker-2026.firebasestorage.app", apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "", authDomain: "idol-tracker-2026.firebaseapp.com" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
getDocs(collection(db, "comebacks")).then(s => {
  const d = s.docs.map(x => x.data());
  console.log("Total:", d.length);
  console.log("Empty MV:", d.filter(x => !x.mediaLinks?.musicVideo).length);
  console.log("Search query MV:", d.filter(x => x.mediaLinks?.musicVideo?.includes("search_query")).length);
  console.log("Other MV:", d.filter(x => x.mediaLinks?.musicVideo && !x.mediaLinks?.musicVideo?.includes("search_query")).length);
});
