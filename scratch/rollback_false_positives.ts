import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../app/firebase";

async function rollback() {
  // 키키: title을 TBA로 롤백
  const q1 = query(collection(db, "comebacks"), where("artistName", "==", "키키"));
  const snap1 = await getDocs(q1);
  for (const d of snap1.docs) {
    if (d.data().title === "KiiiKiii") {
      await updateDoc(doc(db, "comebacks", d.id), { title: "TBA" });
      console.log("Rolled back 키키 title to TBA");
    }
  }

  // NCT 127: title을 TBA로 롤백
  const q2 = query(collection(db, "comebacks"), where("artistName", "==", "NCT 127"));
  const snap2 = await getDocs(q2);
  for (const d of snap2.docs) {
    if (d.data().title === "NCT 127 10TH ANNIVERSARY LIVE") {
      await updateDoc(doc(db, "comebacks", d.id), { title: "TBA" });
      console.log("Rolled back NCT 127 title to TBA");
    }
  }
}

rollback().catch(console.error);
