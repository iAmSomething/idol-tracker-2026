import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

const serviceAccount = require(path.resolve('./serviceAccountKey.json'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('comebacks').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.releaseDate === '2026-07-15' && (data.artistName === '니콜' || data.artistName === '아이덴티티')) {
      console.log(`[False Positive on 15th] ${data.artistName}`);
      console.log(JSON.stringify(data.recentNews, null, 2));
    }
    if (data.releaseDate === '2026-07-13') {
      console.log(`[13th Entry] ${data.artistName} - Title: ${data.title}, Cover: ${data.albumCoverUrl}`);
    }
  }
}

check().catch(console.error);
