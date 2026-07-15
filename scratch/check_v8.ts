import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const artistsSnap = await getDocs(collection(db, "artists"));
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const ko = data.name?.ko || "";
    const en = data.name?.en || "";
    if (ko.toLowerCase().includes("v8") || en.toLowerCase().includes("v8")) {
        console.log("Artist:", d.id, JSON.stringify(data));
    }
  });

  const cbSnap = await getDocs(collection(db, "comebacks"));
  cbSnap.docs.forEach(d => {
    const data = d.data();
    if (data.artistName?.toLowerCase().includes("v8")) {
        console.log("Comeback:", d.id, data.artistName, data.releaseDate, data.title, data.artistId);
    }
  });
}
run().catch(console.error);
