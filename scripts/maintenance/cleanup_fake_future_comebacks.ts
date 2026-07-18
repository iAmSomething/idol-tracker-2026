import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/gimtaehun/idol_tracker/.env' });

const firebaseConfig = {
  projectId: 'idol-tracker-2026',
  appId: '1:47996752520:web:bc7ebc514f82846f3ec53d',
  storageBucket: 'idol-tracker-2026.firebasestorage.app',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'idol-tracker-2026.firebaseapp.com',
  messagingSenderId: '47996752520'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runCleanup() {
  console.log("🔍 Scanning for fake future comebacks...");
  const snapshot = await getDocs(collection(db, 'comebacks'));
  const todayStr = new Date().toISOString().split('T')[0];
  
  const docsToDelete: any[] = [];
  
  snapshot.forEach(d => {
    const data = d.data();
    if (data.releaseDate > todayStr) {
      if (!data.sourceLink) {
        docsToDelete.push({ id: d.id, ...data });
      }
    }
  });
  
  if (docsToDelete.length === 0) {
    console.log("✅ No fake future comebacks found.");
    process.exit(0);
  }
  
  console.log(`🗑️ Found ${docsToDelete.length} documents to delete:`);
  docsToDelete.forEach(d => {
    console.log(` - ${d.artistName} : ${d.releaseDate} (${d.title}) [ID: ${d.id}]`);
  });
  
  const batch = writeBatch(db);
  docsToDelete.forEach(d => {
    batch.delete(doc(db, 'comebacks', d.id));
  });
  
  await batch.commit();
  console.log(`✅ Successfully deleted ${docsToDelete.length} fake future comebacks.`);
  process.exit(0);
}

runCleanup().catch(e => {
  console.error("Cleanup failed:", e);
  process.exit(1);
});
