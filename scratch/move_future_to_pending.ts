import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../app/firebase";

async function moveFutureToPending() {
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const todayStr = new Date().toISOString().split('T')[0];
  let movedCount = 0;

  for (const d of comebacksSnap.docs) {
    const data = d.data();
    // Move if it's a future comeback or TBA, and not released yet
    if (!data.isReleased && (data.releaseDate >= todayStr || data.releaseDate.includes('TBA'))) {
      console.log(`Moving ${data.artistName} - ${data.releaseDate} to pending...`);
      
      await addDoc(collection(db, "pending_reviews"), {
        type: "existing_artist",
        artistName: data.artistName,
        artistId: data.artistId || "",
        releaseDate: data.releaseDate,
        releaseType: data.releaseType || "single",
        sourceTitle: data.title || "TBA",
        sourceLink: data.sourceLink || "",
        createdAt: new Date().toISOString()
      });

      await deleteDoc(doc(db, "comebacks", d.id));
      movedCount++;
    }
  }

  console.log(`Successfully moved ${movedCount} future comebacks to Admin Dashboard.`);
}

moveFutureToPending().catch(console.error);
