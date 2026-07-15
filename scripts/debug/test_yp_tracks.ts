import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { collection, query, where, getDocs } from "firebase/firestore";

dotenv.config({ path: ".env.local" });

async function check() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "Young Posse"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
     console.log("Comeback tracks array in doc:", !!d.data().tracks);
  }
}
check();
