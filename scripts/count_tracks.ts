import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));
async function run() {
  const snap = await getDocs(collection(db, "tracks"));
  console.log("Total tracks:", snap.size);
  process.exit(0);
}
run();
