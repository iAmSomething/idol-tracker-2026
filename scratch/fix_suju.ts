import { collection, getDocs, updateDoc, doc, query, where, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "../app/firebase";

async function fixSuJu() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "슈퍼주니어"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (!d.data().isReleased) {
      console.log("Found Super Junior document:", d.id);
      
      // Update artist in Artists collection? No, let's just update the comeback
      await updateDoc(doc(db, "comebacks", d.id), {
        artistName: "슈퍼주니어-83z",
        artistType: "unit",
        parentGroupName: "슈퍼주니어",
        title: "너를 위한 약속 (Promise)",
        releaseType: "mini",
        releaseDate: "2026-07-13"
      });
      console.log("Updated Super Junior-83z data");
    }
  }
}

fixSuJu();
