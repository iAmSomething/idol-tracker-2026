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

  const extractedName = "NCT 127";
  const search = extractedName.toLowerCase().replace(/\s+/g, '');
  console.log("Searching for:", search);
  
  const found = artists.filter(a => {
    let nameKo = typeof a.name === 'object' ? (a.name.ko || '') : (typeof a.name === 'string' ? a.name : '');
    let nameEn = typeof a.name === 'object' ? (a.name.en || '') : '';
    let ko = nameKo.toLowerCase().replace(/\s+/g, '');
    let en = nameEn.toLowerCase().replace(/\s+/g, '');
    if (ko.includes('nct127') || en.includes('nct127')) {
       console.log(`Comparing DB artist: ID=${a.id}, nameKo=${ko}, nameEn=${en} -> Match? ${ko === search || en === search}`);
    }
    return ko === search || en === search || search.includes(ko);
  });
  console.log("Found:", found);
}
run();
