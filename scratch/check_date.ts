import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkDate() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "아이덴티티"));
  const snapshot = await getDocs(q);
  snapshot.docs.forEach(doc => {
    console.log(`Found comeback: ${doc.id} => ${JSON.stringify(doc.data())}`);
  });
}
checkDate();
