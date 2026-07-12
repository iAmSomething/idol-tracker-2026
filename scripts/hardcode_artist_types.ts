import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { logger } from './lib/logger';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const types: Record<string, string> = {
  '프로미스나인': 'group',
  '루네이트': 'group',
  '혼성': 'group',
  '앤팀': 'group',
  '데이식스': 'group',
  '씨야': 'group',
  '트레저': 'group',
  '카드(KARD)': 'group',
  '엔하이픈': 'group',
  '슈퍼주니어': 'group',
  'NCT 127': 'group',
  '세븐틴': 'group',
  '브브걸': 'group',
  '에스파': 'group',
  '파우': 'group',
  '동방신기': 'group',
  '하츠투하츠': 'group',
  '나우즈': 'group',
  '키키': 'group',
  '오래': 'solo',
  '원호': 'solo',
  '마크': 'solo',
  '이소라': 'solo',
  '유노윤호': 'solo',
  '백아연': 'solo',
  '림킴': 'solo',
  '영케이': 'solo',
  '여름과': 'solo',
  '이민혁': 'solo',
  '효린': 'solo',
  '이본': 'solo',
  '연준 (YEONJUN)': 'solo',
  '오는': 'solo',
  'SM': 'group'
};

async function run() {
  logger.info("Starting hardcoded artist type fixer...");

  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));

  let batch = writeBatch(db);
  let updateCount = 0;

  for (const cb of comebacks) {
    if (!cb.artistType || cb.artistType === 'unknown') {
      const type = types[cb.artistName] || 'group'; // Default to group if missing
      batch.update(doc(db, "comebacks", cb.docId), { artistType: type });
      updateCount++;
      
      const canonicalId = cb.artistName.toLowerCase().replace(/[^a-z0-9가-힣]/g, "").trim();
      
      // We should also set the artistId to canonical if it's 'unknown' or missing
      if (!cb.artistId || cb.artistId === 'unknown') {
         batch.update(doc(db, "comebacks", cb.docId), { artistId: canonicalId });
      }

      // Ensure the artist doc exists
      batch.set(doc(db, "artists", canonicalId), {
          name: { ko: cb.artistName, en: "", aliases: [] },
          type: type,
          generation: 0,
          members: [],
          isActive: true,
          socialLinks: {}
      }, { merge: true });

      if (updateCount % 200 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }

  if (updateCount % 200 !== 0) {
    await batch.commit();
  }

  logger.info(`Finished! Updated ${updateCount} comebacks.`);
  process.exit(0);
}

run().catch(console.error);
