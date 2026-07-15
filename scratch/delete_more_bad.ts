import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
    const snap = await getDocs(collection(db, "comebacks"));
    for (const d of snap.docs) {
        const data = d.data();
        const date = data.releaseDate;
        const name = data.artistName;

        // "뉴진스", "BTS", "에이티즈", "리센느" on the 29th
        if (date === "2026-07-29") {
            if (["뉴진스", "BTS", "에이티즈", "리센느"].includes(name)) {
                console.log(`Deleting fake comeback on 29th: ${name}`);
                await deleteDoc(doc(db, "comebacks", d.id));
            } else if (name === "LUN8") {
                console.log(`Fixing LUN8 date to 22nd...`);
                await updateDoc(doc(db, "comebacks", d.id), { releaseDate: "2026-07-22" });
            }
        }
    }
}
run().catch(console.error);
