import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkDB() {
  const q = query(collection(db, "comebacks"), orderBy("releaseDate", "desc"));
  const snapshot = await getDocs(q);
  console.log("Recent comebacks:");
  let count = 0;
  snapshot.docs.forEach(doc => {
    if (count > 20) return;
    const d = doc.data();
    console.log(`- ${d.releaseDate}: ${d.artistName} (${d.title})`);
    count++;
  });
}
checkDB();
