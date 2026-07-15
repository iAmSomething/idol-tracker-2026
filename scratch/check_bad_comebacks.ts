import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("releaseDate", "==", "2026-07-29"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
      console.log(`[${d.id}] Artist: ${d.data().artistName} | Title: ${d.data().title}`);
  }
}
run().catch(console.error);
