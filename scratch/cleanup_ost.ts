import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: "AIzaSyAaQR2HtiH-KN8hz5aIr4iNn0eWuTsg_yE",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupOSTs() {
  console.log("Fetching all comebacks to check for OSTs...");
  const comebacksRef = collection(db, "comebacks");
  const snapshot = await getDocs(comebacksRef);

  let deletedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const title = (data.title || "").toUpperCase();
    
    if (title.includes("OST") || title.includes("SOUNDTRACK") || title.includes("사운드트랙")) {
      console.log(`Deleting OST: ${data.artistName} - ${data.title} (${data.releaseDate})`);
      await deleteDoc(doc(db, "comebacks", docSnap.id));
      deletedCount++;
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} OST comebacks.`);
  process.exit(0);
}

cleanupOSTs().catch(console.error);
