import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  let deleted = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.artistName === "레드벨벳" && (data.title === "벨벳 서머" || data.title === "서머퀸")) {
      console.log(`Deleting fake Red Velvet comeback: ${d.id} (${data.title})`);
      await deleteDoc(doc(db, "comebacks", d.id));
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} fake comebacks.`);
}
run().catch(console.error);
