import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

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

async function wipeAndUploadData() {
  // Wipe old comebacks
  const colRef = collection(db, 'comebacks');
  const snapshot = await getDocs(colRef);
  console.log(`Found ${snapshot.size} old comebacks. Deleting...`);
  
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, 'comebacks', docSnap.id));
  }
  console.log("Old comebacks wiped.");

  const data = JSON.parse(fs.readFileSync('./backfill_legacy_2026.json', 'utf8'));
  console.log(`Uploading ${data.length} new records...`);

  for (const cb of data) {
    try {
      const docRef = doc(db, 'comebacks', cb.id);
      
      const firestoreData = {
        ...cb,
        releaseDate: Timestamp.fromDate(new Date(cb.releaseDate)),
        createdAt: serverTimestamp(),
      };
      
      await setDoc(docRef, firestoreData);
      console.log(`✅ Uploaded: ${cb.artistName} - ${cb.title}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${cb.id}:`, err);
    }
  }

  console.log('Upload complete! Exiting...');
  process.exit(0);
}

wipeAndUploadData();
