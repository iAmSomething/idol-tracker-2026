import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));
async function run() {
  const cDoc = await getDoc(doc(db, "comebacks", "1EKGKjTdUVBis8TTY3M7"));
  console.log("1EKGKjTdUVBis8TTY3M7:", cDoc.data());
  
  const snap = await getDocs(collection(db, "comebacks"));
  let missingLinks = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.releaseDate < "2026-07-07" && (!data.streamingLinks || !data.streamingLinks.melon)) {
      missingLinks++;
      console.log(`Missing links: [${data.artistName}] ${data.title} (${data.releaseDate}) - isReleased: ${data.isReleased}`);
    }
  });
  console.log(`Total < 07-07 comebacks missing streaming links: ${missingLinks}`);
  process.exit(0);
}
run();
