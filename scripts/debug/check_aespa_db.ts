import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

initializeApp();
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('comebacks')
    .where('artistName', '==', 'aespa')
    .get();

  for (const doc of snapshot.docs) {
    console.log(`FOUND: ${doc.data().title} - ${doc.data().releaseDate}`);
  }
}
run();
