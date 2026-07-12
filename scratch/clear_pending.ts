import * as path from "path";
import * as dotenv from "dotenv";
import { db } from "../scripts/lib/firebase-helpers";
import { collection, getDocs, deleteDoc } from "firebase/firestore";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function clearPending() {
  console.log("Clearing pending_reviews...");
  const snap = await getDocs(collection(db, "pending_reviews"));
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
  console.log(`Cleared ${snap.docs.length} documents.`);
  process.exit(0);
}

clearPending();
