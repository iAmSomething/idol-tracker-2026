import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, deleteDoc, doc, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function cleanup() {
  // We will delete all comebacks created today because they are mostly polluted by the 29th bug and the undefined isMusicComeback bug.
  // Actually, wait, let's just delete ALL comebacks where `createdAt` starts with "2026-07-14".
  const q = query(collection(db, "comebacks"));
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (data.createdAt && data.createdAt.startsWith("2026-07-14")) {
      console.log(`Deleting: ${data.artistName} - ${data.releaseDate}`);
      await deleteDoc(doc(db, "comebacks", document.id));
      deletedCount++;
    }
  }
  console.log(`Deleted ${deletedCount} comebacks created today.`);
}

cleanup();
