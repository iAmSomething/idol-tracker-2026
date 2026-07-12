import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../app/firebase";

async function clearPending() {
  const snap = await getDocs(collection(db, "pending_reviews"));
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "pending_reviews", d.id));
  }
  console.log(`Cleared ${snap.size} pending reviews.`);
}
clearPending();
