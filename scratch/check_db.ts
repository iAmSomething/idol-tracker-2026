import { collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";

async function checkDB() {
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  let count = 0;
  for (const c of comebacksSnap.docs) {
    const data = c.data();
    if (data.isReleased === true && !data.albumCoverUrl) {
      console.log(`Found buggy released comeback: ${data.artistName} (${data.releaseDate})`);
      count++;
    }
  }
  console.log(`Total buggy released comebacks: ${count}`);
}
checkDB();
