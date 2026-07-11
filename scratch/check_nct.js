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
  const snapshot = await getDocs(collection(db, 'artists'));
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const nct = artists.filter(a => JSON.stringify(a).toLowerCase().includes('nct'));
  console.log("NCT related artists in DB:", nct);
  
  const fromis = artists.filter(a => JSON.stringify(a).toLowerCase().includes('fromis') || JSON.stringify(a).toLowerCase().includes('프로미스'));
  console.log("fromis related artists in DB:", fromis);
  
  const rv = artists.filter(a => JSON.stringify(a).toLowerCase().includes('레드벨벳') || JSON.stringify(a).toLowerCase().includes('red velvet'));
  console.log("Red Velvet related artists in DB:", rv);
  
  process.exit(0);
}
run();
