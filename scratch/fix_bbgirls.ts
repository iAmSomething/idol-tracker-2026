import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../app/firebase";

async function fixBBGirls() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "브브걸"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (!d.data().isReleased) {
      console.log("Found BBGIRLS document:", d.id);
      await updateDoc(doc(db, "comebacks", d.id), {
        title: "BODY WAVE",
        releaseType: "single",
        releaseDate: "2026-07-16"
      });
      console.log("Updated BBGIRLS to BODY WAVE, single, 2026-07-16");
    }
  }
}

fixBBGirls();
