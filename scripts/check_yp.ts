import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const ypDoc = await getDoc(doc(db, "comebacks", "영파씨_2026-07-13"));
  if (ypDoc.exists()) {
    console.log("영파씨:", JSON.stringify(ypDoc.data(), null, 2));
  } else {
    console.log("Document does not exist!");
  }
}
run();
