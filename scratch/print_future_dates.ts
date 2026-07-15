import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("releaseDate", ">=", "2026-07-14"));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      const data = d.data();
      const hasNews = !!(data.recentNews && data.recentNews.length > 0);
      const isReleasedVal = data.isReleased;
      console.log(`${d.id} | ${data.artistName} | Date: ${data.releaseDate} | hasNews: ${hasNews} | isReleased: ${isReleasedVal}`);
  });
}
run().catch(console.error);
