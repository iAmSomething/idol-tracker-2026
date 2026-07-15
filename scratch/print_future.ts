import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("isReleased", "==", false), limit(3));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      console.log(d.id, JSON.stringify(d.data(), null, 2));
  });
}
run().catch(console.error);
