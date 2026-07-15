import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  snap.docs.forEach(d => {
      const data = d.data();
      if (data.artistName.includes("연준") || data.artistName.includes("YEONJUN")) {
          console.log(d.id, data.artistName, data.releaseDate, data.title, data.releaseType);
      }
  });
}
run().catch(console.error);
