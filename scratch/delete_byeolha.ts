import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
  const cbs = await getDocs(collection(db, "comebacks"));
  let dCb = 0;
  for (const d of cbs.docs) {
    if (d.data().artistName === "별하" || d.data().title?.includes("나는걸어가네")) {
      console.log(`Deleting comeback: ${d.id}`);
      await deleteDoc(doc(db, "comebacks", d.id));
      dCb++;
    }
  }
  
  const artists = await getDocs(collection(db, "artists"));
  let dAr = 0;
  for (const d of artists.docs) {
    const data = d.data();
    if (data.name?.ko === "별하" || data.name === "별하") {
      console.log(`Deleting artist: ${d.id}`);
      await deleteDoc(doc(db, "artists", d.id));
      dAr++;
    }
  }
  console.log(`Deleted ${dCb} comebacks and ${dAr} artists.`);
}
run().catch(console.error);
