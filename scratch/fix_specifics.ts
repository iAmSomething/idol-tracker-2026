import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function checkAndFix() {
  const snapshot = await getDocs(collection(db, "comebacks"));
  
  for (const document of snapshot.docs) {
    const data = document.data();
    const name = data.artistName;
    
    if (name === "시크릿" || name === "오래") {
      console.log(`Deleting bad comeback: ${name}`);
      await deleteDoc(doc(db, "comebacks", document.id));
    }
    
    if (name === "프로미스나인") {
      console.log(`Fixing fromis_9: ${data.releaseType} -> full`);
      await updateDoc(doc(db, "comebacks", document.id), { releaseType: "full" });
    }
  }
  
  // also check artists
  const artistsSnap = await getDocs(collection(db, "artists"));
  for (const document of artistsSnap.docs) {
    const data = document.data();
    const ko = data.name?.ko;
    const en = data.name?.en;
    if (ko === "시크릿" || en === "시크릿" || ko === "오래" || en === "오래") {
      console.log(`Deleting bad artist: ${ko || en}`);
      await deleteDoc(doc(db, "artists", document.id));
    }
  }
}

checkAndFix();
