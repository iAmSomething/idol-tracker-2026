import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../scripts/lib/firebase-helpers";

async function cleanup() {
  const comebacksRef = collection(db, "comebacks");
  const q = query(comebacksRef, where("artistName", "==", "연준"));
  
  const snap = await getDocs(q);
  console.log(`Found ${snap.docs.length} Yeonjun comebacks.`);
  
  let deletedCount = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.isMissedAndCaught) {
      console.log(`Deleting: ${data.title} (${data.releaseDate})`);
      await deleteDoc(doc(db, "comebacks", d.id));
      deletedCount++;
    }
  }
  
  console.log(`Cleanup complete. Deleted ${deletedCount} comebacks.`);
}

cleanup().catch(console.error);
