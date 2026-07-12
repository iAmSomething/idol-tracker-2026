import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../app/firebase";

async function checkLink() {
  const q = query(collection(db, "comebacks"));
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
    if (d.data().sourceLink) count++;
  }
  console.log(`Total comebacks with sourceLink: ${count}`);
}
checkLink();
