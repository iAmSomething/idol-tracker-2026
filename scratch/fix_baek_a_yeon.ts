import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "백아연"));
  const snap = await getDocs(q);
  
  for (const d of snap.docs) {
      const data = d.data();
      if (data.releaseDate === "2026-07-29") {
          await updateDoc(doc(db, "comebacks", d.id), { releaseDate: "2026-06-29", isReleased: true });
          console.log(`Updated Baek A Yeon comeback ${d.id} to 2026-06-29`);
      }
  }
}
run().catch(console.error);
