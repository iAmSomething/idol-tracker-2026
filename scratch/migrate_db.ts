import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../app/firebase";

async function migrateDB() {
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  let count = 0;
  for (const c of comebacksSnap.docs) {
    const data = c.data();
    if (data.isReleased === true && !data.albumCoverUrl) {
      console.log(`Rolling back buggy released comeback: ${data.artistName} (${data.releaseDate})`);
      await updateDoc(doc(db, "comebacks", c.id), {
        isReleased: false
      });
      count++;
    }
  }
  console.log(`Rolled back ${count} buggy released comebacks.`);
}
migrateDB();
