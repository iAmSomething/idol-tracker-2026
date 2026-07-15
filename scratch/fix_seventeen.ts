import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  for (const d of snap.docs) {
    const data = d.data();
    
    // 1. Delete fake Seventeen "그래미 14관왕"
    if (data.artistName === "세븐틴" && (data.title === "그래미 14관왕" || data.title?.includes("그래미"))) {
      console.log(`Deleting fake Seventeen comeback: ${d.id}`);
      await deleteDoc(doc(db, "comebacks", d.id));
    }

    // 2. Map V8 to Seventeen and fix dates
    if (data.artistName === "V8" || data.artistName === "세븐틴 V8" || data.artistName.toLowerCase() === "v8") {
      console.log(`Found V8 comeback: ${d.id} at ${data.releaseDate}`);
      
      // If it's July 28th, delete it (user said it's wrong)
      if (data.releaseDate === "2026-07-28") {
         console.log(`Deleting incorrect July 28th V8 comeback...`);
         await deleteDoc(doc(db, "comebacks", d.id));
      } else {
         // Map to Seventeen
         await updateDoc(doc(db, "comebacks", d.id), {
           parentGroupName: "세븐틴"
         });
      }
    }
  }

  // Find V8 artist and update
  const artists = await getDocs(collection(db, "artists"));
  let svtId = "";
  for (const d of artists.docs) {
      if (d.data().name?.ko === "세븐틴" || d.data().name === "세븐틴") {
          svtId = d.id;
          break;
      }
  }

  for (const d of artists.docs) {
      const data = d.data();
      const ko = data.name?.ko || data.name;
      if (ko === "V8" || ko === "세븐틴 V8" || String(ko).toLowerCase() === "v8") {
          console.log(`Updating V8 artist relation to Seventeen: ${d.id}`);
          await updateDoc(doc(db, "artists", d.id), {
              parentGroupName: "세븐틴",
              parentGroupId: svtId,
              type: "unit"
          });
      }
  }
}

run().catch(console.error);
