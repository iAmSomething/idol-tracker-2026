import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, limit, query } from "firebase/firestore";
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));
async function run() {
  const snap = await getDocs(query(collection(db, "tracks"), limit(1)));
  if (snap.empty) {
    console.log("No tracks collection.");
  } else {
    console.log("tracks collection exists!");
  }
  
  const cDoc = await getDoc(doc(db, "comebacks", "1EKGKjTdUVBis8TTY3M7"));
  const data = cDoc.data() || {};
  if (data.tracks) {
    console.log("tracks array found in comeback doc:", JSON.stringify(data.tracks[0], null, 2));
  } else {
    console.log("no tracks array in comeback doc");
  }
  process.exit(0);
}
run();
