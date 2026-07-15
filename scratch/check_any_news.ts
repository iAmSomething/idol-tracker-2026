import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  let countWithNews = 0;
  let countTotal = 0;
  snap.docs.forEach(d => {
      const data = d.data();
      countTotal++;
      if (data.recentNews && data.recentNews.length > 0) countWithNews++;
  });
  console.log(`Total comebacks: ${countTotal}`);
  console.log(`Comebacks with recentNews: ${countWithNews}`);
}
run().catch(console.error);
