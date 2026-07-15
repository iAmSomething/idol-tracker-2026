import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
    // Delete comebacks where artistName is "MV"
    const comebacksSnap = await getDocs(collection(db, "comebacks"));
    for (const d of comebacksSnap.docs) {
        const data = d.data();
        if (data.artistName === "MV") {
            console.log("Deleting fake comeback MV on " + data.releaseDate);
            await deleteDoc(doc(db, "comebacks", d.id));
        }
    }
    
    // Delete artists where name is "MV"
    const artistsSnap = await getDocs(collection(db, "artists"));
    for (const d of artistsSnap.docs) {
        const data = d.data();
        const name = data.name?.ko || data.name || "";
        if (name === "MV") {
            console.log("Deleting fake artist MV");
            await deleteDoc(doc(db, "artists", d.id));
        }
    }
}
run().catch(console.error);
