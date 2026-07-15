import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const artistsSnap = await getDocs(collection(db, "artists"));
  let day6Id = "", kardId = "", tvxqId = "", youngKId = "", yunhoId = "";
  let day6EnId = "", kardKrEnId = ""; // phantom artists
  
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const ko = data.name?.ko || "";
    if (ko === "데이식스") day6Id = d.id;
    if (ko === "DAY6") day6EnId = d.id;
    if (ko === "카드") kardId = d.id;
    if (ko === "카드(KARD)") kardKrEnId = d.id;
    if (ko === "동방신기") tvxqId = d.id;
    if (ko === "영케이") youngKId = d.id;
    if (ko === "유노윤호") yunhoId = d.id;
  });

  // 1. Update Artist mappings
  if (day6Id) await updateDoc(doc(db, "artists", day6Id), { "name.en": "DAY6", "name.aliases": ["DAY6"] });
  if (kardId) await updateDoc(doc(db, "artists", kardId), { "name.en": "KARD", "name.aliases": ["카드(KARD)", "KARD"] });
  if (tvxqId) await updateDoc(doc(db, "artists", tvxqId), { "name.en": "TVXQ" });
  if (youngKId && day6Id) await updateDoc(doc(db, "artists", youngKId), { parentGroupName: "데이식스", parentGroupId: day6Id });
  if (yunhoId && tvxqId) await updateDoc(doc(db, "artists", yunhoId), { parentGroupName: "동방신기", parentGroupId: tvxqId });
  
  console.log("Updated artist fields.");

  // 2. Delete Phantom Artists
  if (day6EnId) {
      await deleteDoc(doc(db, "artists", day6EnId));
      console.log("Deleted phantom DAY6 artist.");
  }
  if (kardKrEnId) {
      await deleteDoc(doc(db, "artists", kardKrEnId));
      console.log("Deleted phantom 카드(KARD) artist.");
  }

  // 3. Migrate Comebacks
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacksByArtist = new Map<string, any[]>();
  
  comebacksSnap.docs.forEach(d => {
      const data = d.data();
      if (!comebacksByArtist.has(data.artistName)) comebacksByArtist.set(data.artistName, []);
      comebacksByArtist.get(data.artistName)!.push({ id: d.id, ...data });
  });

  async function mergeComebacks(sourceName: string, targetName: string, targetArtistId: string) {
      const sources = comebacksByArtist.get(sourceName) || [];
      const targets = comebacksByArtist.get(targetName) || [];
      
      for (const s of sources) {
          // check if target already has this date
          const existsInTarget = targets.find(t => t.releaseDate === s.releaseDate);
          if (existsInTarget) {
              // merge recentNews
              const newNews = s.recentNews || [];
              const oldNews = existsInTarget.recentNews || [];
              const combinedNews = [...oldNews];
              for (const n of newNews) {
                  if (!combinedNews.find((cn:any) => cn.link === n.link)) {
                      combinedNews.push(n);
                  }
              }
              await updateDoc(doc(db, "comebacks", existsInTarget.id), { recentNews: combinedNews });
              await deleteDoc(doc(db, "comebacks", s.id));
              console.log(`Merged ${sourceName} into ${targetName} for ${s.releaseDate} and deleted source.`);
          } else {
              // just rename
              await updateDoc(doc(db, "comebacks", s.id), { artistName: targetName, artistId: targetArtistId });
              console.log(`Renamed comeback ${sourceName} -> ${targetName} for ${s.releaseDate}`);
          }
      }
  }

  if (day6Id) await mergeComebacks("DAY6", "데이식스", day6Id);
  if (kardId) await mergeComebacks("카드(KARD)", "카드", kardId);
  
  console.log("Done fixing specific aliases!");
}
run().catch(console.error);
