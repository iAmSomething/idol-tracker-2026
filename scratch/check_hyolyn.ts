import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "효린"));
  const snap = await getDocs(q);
  console.log("Hyolyn comebacks:");
  snap.docs.forEach(d => {
    console.log(d.id, d.data().releaseDate, d.data().title, d.data().releaseType, d.data().albumCoverUrl ? "Has Cover" : "No Cover");
  });
}
check().catch(console.error);
