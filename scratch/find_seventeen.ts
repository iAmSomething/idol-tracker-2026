import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  for (const d of snap.docs) {
    const data = d.data();
    const title = data.title || "";
    const artistName = data.artistName || "";
    
    if (artistName.includes("세븐틴") || title.includes("세븐틴") || title.includes("그래미") || artistName.includes("그래미")) {
        console.log(`Found: ${d.id} | Artist: ${artistName} | Title: ${title} | Date: ${data.releaseDate}`);
        if (title.includes("그래미")) {
            console.log(`Deleting fake comeback: ${d.id}`);
            await deleteDoc(doc(db, "comebacks", d.id));
        }
    }
  }
}

run().catch(console.error);
