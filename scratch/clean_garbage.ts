import * as path from "path";
import * as dotenv from "dotenv";
import { db } from "../scripts/lib/firebase-helpers";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function cleanGarbage() {
  const garbageNames = ["걸그룹", "신", "아이오아이", "신인", "보이그룹", "아이돌"];
  
  // Clean artists
  const artistsSnap = await getDocs(collection(db, "artists"));
  for (const d of artistsSnap.docs) {
    const data = d.data();
    const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
    if (garbageNames.includes(name)) {
      await deleteDoc(doc(db, "artists", d.id));
      console.log(`Deleted garbage artist: ${name}`);
    }
  }

  // Clean pending_reviews
  const pendingSnap = await getDocs(collection(db, "pending_reviews"));
  for (const d of pendingSnap.docs) {
    const data = d.data();
    if (garbageNames.includes(data.artistName) || !data.artistName) {
      await deleteDoc(doc(db, "pending_reviews", d.id));
      console.log(`Deleted garbage pending review for: ${data.artistName}`);
    }
  }

  console.log("Cleanup complete.");
  process.exit(0);
}

cleanGarbage();
