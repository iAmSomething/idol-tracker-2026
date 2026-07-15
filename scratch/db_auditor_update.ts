import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function patchAuditor() {
    console.log("Fetching artists to build alias map...");
    const artistsSnap = await getDocs(collection(db, "artists"));
    const aliasesMap: Record<string, string> = {}; // alias -> mainName
    
    for (const d of artistsSnap.docs) {
        const data = d.data();
        const mainName = data.name?.ko || data.name || "";
        aliasesMap[mainName.toLowerCase()] = mainName;
        if (data.name?.en) aliasesMap[data.name.en.toLowerCase()] = mainName;
        if (Array.isArray(data.aliases)) {
            for (const alias of data.aliases) {
                aliasesMap[alias.toLowerCase()] = mainName;
            }
        }
    }

    const comebacksSnap = await getDocs(collection(db, "comebacks"));
    const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    // Check for Alias Duplications on the same day using the alias map
    const byDate: Record<string, any[]> = {};
    for (const c of comebacks) {
        if (!byDate[c.releaseDate]) byDate[c.releaseDate] = [];
        byDate[c.releaseDate].push(c);
    }

    for (const date in byDate) {
        const cbs = byDate[date];
        if (cbs.length <= 1) continue;
        
        for (let i = 0; i < cbs.length; i++) {
            for (let j = i + 1; j < cbs.length; j++) {
                const a = cbs[i];
                const b = cbs[j];
                if (!a || !b) continue;

                const aMain = aliasesMap[a.artistName.toLowerCase()] || a.artistName;
                const bMain = aliasesMap[b.artistName.toLowerCase()] || b.artistName;

                if (aMain === bMain && a.artistName !== b.artistName) {
                    console.log(`🚨 [AUDIT: ALIAS MAP] Found mapped aliases '${a.artistName}' and '${b.artistName}' for '${aMain}' on ${date}.`);
                    
                    // Keep the one that matches mainName exactly, or the shorter one
                    let toDelete = a;
                    if (b.artistName === aMain) toDelete = a;
                    else if (a.artistName === aMain) toDelete = b;
                    else if (a.artistName.length > b.artistName.length) toDelete = a;
                    else toDelete = b;
                    
                    console.log(`   -> Auto-resolving: Deleting '${toDelete.artistName}' (${toDelete.id})`);
                    await deleteDoc(doc(db, "comebacks", toDelete.id));
                    if (toDelete.id === a.id) cbs[i] = null;
                    if (toDelete.id === b.id) cbs[j] = null;
                }
            }
        }
    }
}
patchAuditor().catch(console.error);
