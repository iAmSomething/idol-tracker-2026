import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  const comebacks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const aespa = comebacks.filter((c: any) => c.artistName === "에스파" || c.artistName === "aespa");
  console.log("AESPA length:", aespa.length);
  for (const a of aespa) {
    console.log(`${a.id}: ${a.title} - ${a.releaseDate} (${a.createdAt || 'N/A'}) - isMissedAndCaught: ${a.isMissedAndCaught}`);
  }

  const gcm = comebacks.filter((c: any) => c.artistName === "구창모");
  console.log("GCM length:", gcm.length);
  for (const a of gcm) {
    console.log(`${a.id}: ${a.title} - ${a.releaseDate} (${a.createdAt || 'N/A'}) - isMissedAndCaught: ${a.isMissedAndCaught}`);
  }
}
run();
