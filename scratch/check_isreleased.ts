import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  
  const todayStr = new Date().toISOString().split('T')[0];
  let futureButReleased = 0;
  snap.docs.forEach(d => {
      const data = d.data();
      if (data.releaseDate >= todayStr && data.isReleased === true) {
          futureButReleased++;
          console.log(`Future but isReleased=true: ${d.id} | ${data.artistName} | ${data.releaseDate} | ${data.title}`);
      }
  });
  console.log(`Total future comebacks with isReleased=true: ${futureButReleased}`);
}
run().catch(console.error);
