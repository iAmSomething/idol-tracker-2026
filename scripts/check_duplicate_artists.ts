import dotenv from 'dotenv';
dotenv.config();
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

async function checkArtists() {
  const artistsSnap = await getDocs(collection(db, 'artists'));
  const nameToId = new Map<string, string[]>();
  
  artistsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const nameKo = data.name?.ko || '';
    const nameEn = data.name?.en || '';
    const aliases = data.aliases || [];
    
    if (nameKo === '연준' || nameKo === 'SM' || nameEn.includes('yeonjun') || nameEn.includes('sm')) {
      console.log(`Found artist: [${docSnap.id}] ${nameKo} / ${nameEn}`);
    }
  });
}

checkArtists().catch(console.error);
