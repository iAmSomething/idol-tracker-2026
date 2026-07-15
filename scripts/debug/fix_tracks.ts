import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { collection, query, getDocs, deleteDoc } from "firebase/firestore";

dotenv.config({ path: ".env.local" });

async function fix() {
  const snap = await getDocs(collection(db, "tracks"));
  for (const d of snap.docs) {
     const data = d.data();
     if (data.name === undefined || data.name === null) {
         console.log("Deleting track without name:", d.id);
         await deleteDoc(d.ref);
     }
  }
  console.log("Done");
}
fix();
