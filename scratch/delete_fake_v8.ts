import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  await deleteDoc(doc(db, "comebacks", "pKVu16gzzXcD7TrG7UXT"));
  console.log("Deleted fake July 28 comeback pKVu16gzzXcD7TrG7UXT");
}
run().catch(console.error);
