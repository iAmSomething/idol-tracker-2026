import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  const comebacks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const aespa = comebacks.filter((c: any) => c.artistName === "에스파" || c.artistName === "aespa");
  console.log("AESPA:", JSON.stringify(aespa, null, 2));

  const gcm = comebacks.filter((c: any) => c.artistName === "구창모");
  console.log("구창모:", JSON.stringify(gcm, null, 2));
}
run();
