import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, deleteDoc, doc, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function cleanupArtists() {
  const q = query(collection(db, "artists"));
  const snapshot = await getDocs(q);
  
  let deletedCount = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    // artists collection might not have createdAt, but let's check
    if (data.createdAt && data.createdAt.startsWith("2026-07-14")) {
      console.log(`Deleting artist: ${data.name.ko || data.name.en || JSON.stringify(data.name)}`);
      await deleteDoc(doc(db, "artists", document.id));
      deletedCount++;
    } else if (["벨벳", "김태형", "디렉션(D:D)", "8TURN", "아홉(AHOF)", "아홉", "리센느 미나미"].includes(data.name?.ko || data.name?.en)) {
      console.log(`Deleting specific bad artist: ${data.name.ko || data.name.en}`);
      await deleteDoc(doc(db, "artists", document.id));
      deletedCount++;
    }
  }
  console.log(`Deleted ${deletedCount} artists.`);
}

cleanupArtists();
