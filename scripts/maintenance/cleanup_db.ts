import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  const comebacks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Group by artistName + releaseDate
  const groups: Record<string, any[]> = {};
  for (const c of comebacks) {
    const key = `${c.artistName}_${c.releaseDate}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  let deleted = 0;
  for (const key in groups) {
    const items = groups[key];
    if (items.length > 1) {
      // Sort by has title, then has streamingLinks, then newest
      items.sort((a, b) => {
        if (a.title !== "TBA" && b.title === "TBA") return -1;
        if (b.title !== "TBA" && a.title === "TBA") return 1;
        if (a.streamingLinks && !b.streamingLinks) return -1;
        if (b.streamingLinks && !a.streamingLinks) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      console.log(`Duplicate found for ${key}: keeping ${items[0].id}, deleting ${items.slice(1).length} items`);
      for (let i = 1; i < items.length; i++) {
        await deleteDoc(doc(db, "comebacks", items[i].id));
        deleted++;
      }
    }
  }

  console.log(`Deleted ${deleted} duplicate comebacks.`);

  // Also clean up non-idols added recently (like 구창모, 송골매, 씨야, 브브걸 maybe? 브브걸 is idol, 씨야 is vocal group)
  const nonIdols = ["구창모", "송골매", "오유진", "손준형", "권진아", "여은", "대건", "정욱", "서은교", "이본"];
  for (const c of comebacks) {
    if (nonIdols.includes(c.artistName) || c.artistName.includes("씨야") || c.artistName.includes("플레야")) {
       console.log(`Deleting non-idol: ${c.artistName}`);
       await deleteDoc(doc(db, "comebacks", c.id));
       // delete from artists too
       if (c.artistId) {
         try {
           await deleteDoc(doc(db, "artists", c.artistId));
         } catch(e) {}
       }
    }
  }

  console.log("Cleanup done.");
  process.exit(0);
}
run();
