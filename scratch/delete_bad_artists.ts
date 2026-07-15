import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

const badNames = [
    "뮤직뱅크", "TURN", "기적", "벨벳", "쉼표", "남규리", "아이덴티티", "아홉", 
    "비주얼", "프리티걸", "민니", "신예", "오래", "기현", "미나미", "효연" 
];

async function run() {
  // Delete artists
  const q = query(collection(db, "artists"));
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
      const data = d.data();
      const name = data.name.ko || data.name;
      if (typeof name === "string" && badNames.includes(name)) {
          console.log(`Deleting artist ${name}...`);
          await deleteDoc(doc(db, "artists", d.id));
          count++;
      }
  }
  console.log(`Deleted ${count} garbage artists.`);
}
run().catch(console.error);
