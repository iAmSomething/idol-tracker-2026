import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkAndFix() {
  const snapshot = await getDocs(collection(db, "comebacks"));
  
  for (const document of snapshot.docs) {
    const data = document.data();
    const name = data.artistName || "";
    
    if (name.includes("시크릿") || name.includes("오래")) {
      console.log(`Deleting bad comeback: ${name} (${document.id})`);
      await deleteDoc(doc(db, "comebacks", document.id));
    }
    
    if (name.includes("프로미스나인") || name.includes("fromis_9")) {
      console.log(`Fixing fromis_9: ${data.releaseType} -> full`);
      await updateDoc(doc(db, "comebacks", document.id), { releaseType: "full" });
    }
  }
}

checkAndFix();
