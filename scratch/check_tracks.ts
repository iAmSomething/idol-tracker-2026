import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "에이퓨처 (AFuture)"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
      console.log("Comeback:", d.data().mediaLinks);
      const tq = query(collection(db, "tracks"), where("comebackId", "==", d.id));
      const ts = await getDocs(tq);
      ts.forEach(t => console.log("Track MV:", t.data().title, t.data().musicVideoUrl));
  }
}
run().catch(console.error);
