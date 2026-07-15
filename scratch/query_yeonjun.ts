import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../scripts/lib/firebase-helpers";

async function test() {
  const comebacksRef = collection(db, "comebacks");
  const artistQuery = query(comebacksRef, where("artistName", "==", "연준"));
  const comebacksSnap = await getDocs(artistQuery);
  
  comebacksSnap.forEach((doc) => {
    console.log(doc.data());
  });
}
test().catch(console.error);
