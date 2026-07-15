import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
    const snap = await getDocs(collection(db, "comebacks"));
    for (const d of snap.docs) {
        const data = d.data();
        if (data.artistName === "아일릿" && data.releaseDate === "2026-07-29") {
            console.log("Updating 아일릿 to 26th and setting title...");
            await updateDoc(doc(db, "comebacks", d.id), {
                releaseDate: "2026-07-26",
                title: "I Got Your Back",
                releaseType: "single"
            });
        }
    }
}
run().catch(console.error);
