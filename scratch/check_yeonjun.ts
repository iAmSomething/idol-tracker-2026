import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "in", ["연준", "YEONJUN", "투모로우바이투게더 연준"]));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      const data = d.data();
      console.log(d.id, data.artistName, data.releaseDate, data.title, data.releaseType);
  });
}
run().catch(console.error);
