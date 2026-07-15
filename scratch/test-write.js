import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc514f82846f3ec53d", storageBucket: "idol-tracker-2026.firebasestorage.app", apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "", authDomain: "idol-tracker-2026.firebaseapp.com" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
addDoc(collection(db, "test"), { hello: "world" }).then(() => console.log("OK")).catch(console.error);
