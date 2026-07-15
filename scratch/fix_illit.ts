import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkIllit() {
  const q2 = query(collection(db, "comebacks"), where("artistName", "==", "아일릿"));
  const snapshot2 = await getDocs(q2);
  snapshot2.docs.forEach(async (document) => {
    console.log(`Found ILLIT: ${document.id} => ${document.data().releaseDate}`);
    console.log(`News: ${JSON.stringify(document.data().recentNews, null, 2)}`);
    console.log(`Source title: ${document.data().sourceTitle}`);
    
    // Update ILLIT to 2026-07-26 and type to single
    await updateDoc(doc(db, "comebacks", document.id), {
      releaseDate: "2026-07-26",
      releaseType: "single",
      title: "I Got Your Back"
    });
  });
}
checkIllit();
