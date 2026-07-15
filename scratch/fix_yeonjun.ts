import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const artistsSnap = await getDocs(collection(db, "artists"));
  let txtId = "", yeonjunId1 = "", yeonjunId2 = "";
  
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const ko = data.name?.ko || "";
    if (ko === "투모로우바이투게더" || ko === "TOMORROW X TOGETHER") txtId = d.id;
    if (ko === "연준") yeonjunId1 = d.id;
    if (ko === "연준 (YEONJUN)") yeonjunId2 = d.id;
  });

  // 1. Alias & Parent mapping
  if (yeonjunId1) {
      await updateDoc(doc(db, "artists", yeonjunId1), { 
          "name.en": "YEONJUN", 
          "name.aliases": ["연준 (YEONJUN)", "YEONJUN"],
          parentGroupName: "투모로우바이투게더",
          parentGroupId: txtId
      });
  }
  
  if (yeonjunId2) {
      await deleteDoc(doc(db, "artists", yeonjunId2));
  }

  // 2. Merge comebacks
  const mainCbId = "yeonjun_no_labels_part_02";
  const remixCbId = "8SAODalmmK6Q4cfquLDH";

  const remixDoc = await getDocs(query(collection(db, "comebacks"), where("__name__", "==", remixCbId)));
  const mainDoc = await getDocs(query(collection(db, "comebacks"), where("__name__", "==", mainCbId)));

  if (!remixDoc.empty && !mainDoc.empty) {
      const remixData = remixDoc.docs[0].data();
      const mainData = mainDoc.docs[0].data();
      
      const newNews = remixData.recentNews || [];
      const oldNews = mainData.recentNews || [];
      const combinedNews = [...oldNews];
      for (const n of newNews) {
          if (!combinedNews.find((cn:any) => cn.link === n.link)) {
              combinedNews.push(n);
          }
      }

      await updateDoc(doc(db, "comebacks", mainCbId), {
          artistName: "연준",
          artistId: yeonjunId1,
          recentNews: combinedNews,
          title: "NO LABELS: PART 02"
      });
      await deleteDoc(doc(db, "comebacks", remixCbId));
      console.log("Merged Yeonjun comebacks successfully.");
  }
}
run().catch(console.error);
