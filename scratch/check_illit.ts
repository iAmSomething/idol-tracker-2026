import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkDate() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "아이덴티티"));
  const snapshot = await getDocs(q);
  snapshot.docs.forEach(async (document) => {
    console.log(`Deleting comeback: 아이덴티티 ${document.id}`);
    await deleteDoc(doc(db, "comebacks", document.id));
  });

  const q2 = query(collection(db, "comebacks"), where("artistName", "==", "아일릿"));
  const snapshot2 = await getDocs(q2);
  snapshot2.docs.forEach(doc => {
    console.log(`Found ILLIT: ${doc.id} => ${doc.data().releaseDate}`);
  });
}
checkDate();
