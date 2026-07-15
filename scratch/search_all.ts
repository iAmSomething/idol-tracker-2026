import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  for (const d of snap.docs) {
      const data = d.data();
      const str = JSON.stringify(data);
      if (str.includes("그래미") || str.includes("14관왕") || str.includes("V8") || str.includes("v8")) {
          console.log(`Match: ${d.id} | Artist: ${data.artistName} | Date: ${data.releaseDate} | Title: ${data.title}`);
      }
  }
}
run().catch(console.error);
