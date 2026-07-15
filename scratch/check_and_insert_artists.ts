import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const artistsToCheck = [
  "빅뱅",
  "BIGBANG",
  "Stray Kids",
  "스트레이 키즈",
  "선미",
  "SUNMI",
  "8TURN",
  "에잇턴",
  "fromis_9",
  "프로미스나인",
  "효린",
  "Hyolyn",
  "NCT 127",
  "NCT127"
];

async function run() {
  const artistsRef = collection(db, 'artists');
  const snap = await getDocs(artistsRef);
  const existingNames = snap.docs.map(d => d.data().name.toLowerCase());
  
  for (const name of ["빅뱅", "Stray Kids", "선미", "8TURN", "fromis_9", "효린", "NCT 127"]) {
    if (!existingNames.includes(name.toLowerCase())) {
      console.log(`Inserting missing artist: ${name}`);
      await addDoc(artistsRef, {
        name,
        type: 'group', // simplified
        agencyId: 'unknown',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      console.log(`Artist already exists: ${name}`);
    }
  }
  process.exit(0);
}

run();
