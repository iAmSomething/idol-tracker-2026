import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
    const snap = await getDocs(collection(db, "comebacks"));
    for (const d of snap.docs) {
        const data = d.data();
        // Delete LUN8 on 22nd
        if (data.artistName === "LUN8" && data.releaseDate === "2026-07-22") {
            console.log("Deleting LUN8 on 22nd");
            await deleteDoc(doc(db, "comebacks", d.id));
        }
        // Delete 시크릿 on July 18th
        if (data.artistName === "시크릿" && data.releaseDate === "2026-07-18") {
            console.log("Deleting 시크릿 on 18th");
            await deleteDoc(doc(db, "comebacks", d.id));
        }
    }
}
run().catch(console.error);
