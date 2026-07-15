import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

const badNames = [
    "뮤직뱅크", "TURN", "기적", "벨벳", "쉼표", "남규리", "아이덴티티", "아홉", 
    "비주얼", "프리티걸", "민니", "신예", "오래", "기현", "미나미", "효연" // 민니, 기현, 효연 are real idols but if they are fake comebacks with "TBA", let's check
];

async function run() {
  const q = query(collection(db, "comebacks"));
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
      const data = d.data();
      if (badNames.includes(data.artistName) && data.title === "TBA") {
          console.log(`Deleting ${data.artistName}...`);
          await deleteDoc(doc(db, "comebacks", d.id));
          count++;
      }
      // Also delete some that have title 's new single' which is likely bad extraction
      else if (data.title === "s new single" || data.artistName === "신예") {
          console.log(`Deleting ${data.artistName}...`);
          await deleteDoc(doc(db, "comebacks", d.id));
          count++;
      }
  }
  console.log(`Deleted ${count} garbage comebacks.`);
}
run().catch(console.error);
