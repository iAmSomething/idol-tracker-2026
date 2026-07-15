import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { logger } from '../lib/logger';

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
  logger.info("Starting Comeback artistType Fixer...");

  const artistSnap = await getDocs(collection(db, "artists"));
  const artistsMap = new Map();
  artistSnap.docs.forEach(d => {
    artistsMap.set(d.id, d.data().type || 'unknown');
  });

  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));

  let batch = writeBatch(db);
  let updateCount = 0;

  for (const cb of comebacks) {
    const correctType = artistsMap.get(cb.artistId);
    if (correctType && correctType !== 'unknown' && cb.artistType !== correctType) {
      batch.update(doc(db, "comebacks", cb.docId), { artistType: correctType });
      updateCount++;
      
      if (updateCount % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }

  if (updateCount % 400 !== 0) {
    await batch.commit();
  }

  logger.info(`Finished! Updated artistType for ${updateCount} comebacks.`);
  process.exit(0);
}

run().catch(e => {
  logger.error("Fixer Failed", e);
  process.exit(1);
});
