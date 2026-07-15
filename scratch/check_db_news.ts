import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const artists = ["파우", "카드(KARD)", "레드벨벳"];
  for (const a of artists) {
      const q = query(collection(db, "comebacks"), where("artistName", "==", a), limit(1));
      const snap = await getDocs(q);
      snap.forEach(d => {
          console.log(`\n=== ${a} ===`);
          console.log("News:", d.data().recentNews);
          console.log("Summary:", d.data().aiSummary);
      });
  }
}
run().catch(console.error);
