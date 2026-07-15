import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "파우"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => console.dir(d.data(), { depth: null }));
}
run().catch(console.error);
