import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  for (const d of snap.docs) {
    const data = d.data();
    if (data.artistName === "레드벨벳" || data.title?.includes("벨벳 서머")) {
      console.log(d.id, data);
    }
  }
}
run().catch(console.error);
