import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { collection, query, getDocs, deleteDoc, where } from "firebase/firestore";

dotenv.config({ path: ".env.local" });

async function fix() {
  const snap = await getDocs(query(collection(db, "comebacks"), where("artistName", "==", "aespa")));
  for (const d of snap.docs) {
     const data = d.data();
     if (data.releaseDate === '2026-07-14') {
         if (data.title.toLowerCase().includes('mix') || data.title.toLowerCase().includes('symphonic') || data.title.includes('SYNK')) {
            console.log("Deleting aespa remix:", data.title);
            await deleteDoc(d.ref);
         }
     }
  }
  console.log("Done");
}
fix();
