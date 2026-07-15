import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, "artists"), where("name.ko", "==", "데이식스"));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      console.log(JSON.stringify(d.data(), null, 2));
  });
}
check().catch(console.error);
