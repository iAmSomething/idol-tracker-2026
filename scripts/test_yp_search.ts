import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { collection, query, getDocs } from "firebase/firestore";

dotenv.config({ path: ".env.local" });

async function check() {
  const snap = await getDocs(collection(db, "comebacks"));
  for (const d of snap.docs) {
     const data = d.data();
     if (data.artistName.toLowerCase().includes("young") || data.artistName.toLowerCase().includes("posse") || data.artistName.includes("영파씨")) {
         console.log("Comeback:", d.id, data.artistName, data.title, data.releaseDate);
         const tq = query(collection(db, "tracks"), require("firebase/firestore").where("comebackId", "==", d.id));
         const ts = await getDocs(tq);
         console.log(` Tracks count: ${ts.size}`);
         ts.docs.forEach(t => console.log("   -", t.data().name, t.data().isTitle));
     }
  }
}
check();
