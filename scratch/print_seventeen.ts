import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "세븐틴"));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      console.log(d.id, d.data().releaseDate, d.data().title);
  });
}
run().catch(console.error);
