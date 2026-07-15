import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, "artists"), where("name.ko", "in", ["데이식스", "DAY6", "카드", "동방신기", "유노윤호", "영케이"]));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      console.log(d.id, d.data().name.ko, d.data().name.en, d.data().name.aliases);
  });
}
check().catch(console.error);
