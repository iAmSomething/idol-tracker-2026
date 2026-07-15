import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const ids = [
    "WOOAH_2026-07-13",
    "디렉션(D:D)_2026-07-13",
    "손준형_2026-07-13",
    "아이덴티티_2026-07-13",
    "영파씨_2026-07-13"
  ];
  for (const id of ids) {
    await deleteDoc(doc(db, "comebacks", id));
    console.log("Deleted", id);
  }
}
run();
