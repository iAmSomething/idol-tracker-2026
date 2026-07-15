import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("isReleased", "==", false));
  const snap = await getDocs(q);
  
  let missingCount = 0;
  snap.docs.forEach(d => {
      const data = d.data();
      if (!data.recentNews || data.recentNews.length === 0) {
          missingCount++;
          console.log(`Missing News: ${d.id} | ${data.artistName} | ${data.releaseDate} | ${data.title}`);
      }
  });
  console.log(`Total future comebacks missing recentNews: ${missingCount}`);
}
run().catch(console.error);
