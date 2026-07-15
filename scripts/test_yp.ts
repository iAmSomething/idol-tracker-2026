import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { collection, query, where, getDocs } from "firebase/firestore";

dotenv.config({ path: ".env.local" });

async function check() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "YOUNG POSSE"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
     console.log("Comeback:", d.id, d.data().title, d.data().releaseDate);
     const tq = query(collection(db, "tracks"), where("comebackId", "==", d.id));
     const ts = await getDocs(tq);
     console.log(` Tracks count: ${ts.size}`);
     ts.docs.forEach(t => console.log("   -", t.data().name, t.data().isTitle));
  }
}
check();
