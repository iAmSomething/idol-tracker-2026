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
  const snapshot = await getDocs(collection(db, 'comebacks'));
  const comebacks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log("Future Comebacks:");
  for (const c of comebacks) {
    if (c.date >= '2026-07-10') {
      console.log(`- ${c.artistName}: ${c.date} (Status: ${c.status})`);
    }
  }

  const artistsSnap = await getDocs(collection(db, 'artists'));
  const artists = artistsSnap.docs.map(d => d.data());

  for (const c of comebacks) {
    if (c.date >= '2026-07-10') {
      const a = artists.find(x => {
        const ko = typeof x.name === 'object' ? (x.name.ko || '') : (typeof x.name === 'string' ? x.name : '');
        const en = typeof x.name === 'object' ? (x.name.en || '') : '';
        return ko.includes(c.artistName) || en.includes(c.artistName) || (c.artistName.includes(ko) && ko.length > 1);
      });
      if (a) {
        console.log(`\nArtist found for ${c.artistName}:`);
        console.log(`  YouTube: ${a.socialLinks?.youtube || 'None'}`);
      }
    }
  }
  process.exit(0);
}
run();
