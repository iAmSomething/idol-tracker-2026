import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, addDoc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const artistsSnap = await getDocs(collection(db, "artists"));
  let seventeenId = "", v8Id = "";
  
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const ko = data.name?.ko || "";
    if (ko === "세븐틴" || ko === "SEVENTEEN") seventeenId = d.id;
    if (ko === "V8") v8Id = d.id;
  });

  // 1. Ensure V8 artist exists
  if (!v8Id) {
      const newV8 = await addDoc(collection(db, "artists"), {
          name: { ko: "V8", en: "V8", aliases: [] },
          type: "unit",
          gender: "male",
          parentGroupName: "세븐틴",
          parentGroupId: seventeenId,
          createdAt: new Date().toISOString()
      });
      v8Id = newV8.id;
      console.log("Created V8 artist doc.");
  } else {
      if (seventeenId) {
          await updateDoc(doc(db, "artists", v8Id), { parentGroupName: "세븐틴", parentGroupId: seventeenId });
          console.log("Updated V8 artist parent.");
      }
  }

  // 2. Fix the Comeback
  const cbId = "pKVu16gzzXcD7TrG7UXT";
  await updateDoc(doc(db, "comebacks", cbId), {
      artistName: "V8",
      artistId: v8Id,
      title: "V8",
      releaseType: "mini"
  });
  console.log("Fixed SEVENTEEN fake comeback to V8 real comeback.");
}
run().catch(console.error);
