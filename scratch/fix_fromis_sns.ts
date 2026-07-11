import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixFromisSns() {
  console.log("Fixing fromis_9 YouTube channel link...");
  const fromisArtistRef = doc(db, 'artists', 'lWSTNg39KwjY8FzPmZsD');
  await updateDoc(fromisArtistRef, {
    "socialLinks.youtube": "https://youtube.com/@fromis9_official"
  });
  console.log("Successfully updated fromis_9 YouTube link to https://youtube.com/@fromis9_official!");
}

fixFromisSns().catch(console.error);
