import dotenv from 'dotenv';
dotenv.config();
import { db } from './lib/firebase-helpers';
import { collection, getDocs } from 'firebase/firestore';

async function inspectArtists() {
  const snap = await getDocs(collection(db, "artists"));
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  const targets = ["연준", "yeonjun", "txt", "투모로우바이투게더", "tomorrow"];
  const matches = artists.filter(a => {
    const name = a.name ? String(a.name) : "";
    return targets.some(t => name.toLowerCase().includes(t.toLowerCase()));
  });

  console.log("Matching Artists in DB:");
  matches.forEach(a => {
    console.log(`- ID: ${a.id}`);
    console.log(`  Name: "${a.name}"`);
    console.log(`  Type: "${a.type}"`);
  });
  
  process.exit(0);
}

inspectArtists().catch(console.error);
