import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function run() {
    const comebacksSnap = await getDocs(collection(db, "comebacks"));
    const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    // Group by Date
    const byDate: Record<string, any[]> = {};
    for (const c of comebacks) {
        if (!byDate[c.releaseDate]) byDate[c.releaseDate] = [];
        byDate[c.releaseDate].push(c);
    }

    let deleted = 0;

    for (const date in byDate) {
        const cbs = byDate[date];
        if (cbs.length <= 1) continue;
        
        // 1. Alias deduplication
        // If one name is included in another (e.g. "효린" and "효린(HYOLYN)")
        for (let i = 0; i < cbs.length; i++) {
            for (let j = i + 1; j < cbs.length; j++) {
                const a = cbs[i];
                const b = cbs[j];
                if (!a || !b) continue;

                if (a.artistName.includes(b.artistName) || b.artistName.includes(a.artistName)) {
                    // One is an alias of the other. Keep the shorter one or the one without parens.
                    let toDelete = a;
                    if (a.artistName.includes("(") && !b.artistName.includes("(")) toDelete = a;
                    else if (b.artistName.includes("(") && !a.artistName.includes("(")) toDelete = b;
                    else if (a.artistName.length > b.artistName.length) toDelete = a;
                    else toDelete = b;

                    console.log(`[ALIAS DUP] Deleting ${toDelete.artistName} on ${date}. Kept the other.`);
                    await deleteDoc(doc(db, "comebacks", toDelete.id));
                    if (toDelete.id === a.id) cbs[i] = null;
                    if (toDelete.id === b.id) cbs[j] = null;
                    deleted++;
                }
            }
        }
        
        // 2. Group vs Member deduplication
        // Wait, how do we know if it's Group vs Member?
        // We can check if `parentGroupId` or `parentGroupName` matches.
        // But some artists might not have it properly linked yet.
        // Let's hardcode the ones we saw, or rely on parentGroupName.
        for (let i = 0; i < cbs.length; i++) {
            for (let j = 0; j < cbs.length; j++) {
                if (i === j) continue;
                const a = cbs[i];
                const b = cbs[j];
                if (!a || !b) continue;
                
                // If a is a group, and b is a member of a
                // If b.parentGroupName === a.artistName
                if (b.parentGroupName && b.parentGroupName === a.artistName) {
                    console.log(`[GROUP/MEMBER DUP] Deleting Group ${a.artistName} because Member ${b.artistName} is the actual comeback on ${date}`);
                    await deleteDoc(doc(db, "comebacks", a.id));
                    cbs[i] = null;
                    deleted++;
                }
            }
        }
    }
    
    // Hardcoded cleanup for the ones where parentGroup might not be linked properly
    const hardcoded = [
        { group: "데이식스", member: "영케이", date: "2026-07-27" },
        { group: "동방신기", member: "유노윤호", date: "2026-07-20" },
        { group: "방탄소년단", member: "지민", date: "2026-07-19" },
    ];
    for (const h of hardcoded) {
        const groupCb = comebacks.find(c => c.artistName === h.group && c.releaseDate === h.date);
        const memberCb = comebacks.find(c => c.artistName === h.member && c.releaseDate === h.date);
        if (groupCb && memberCb) {
             console.log(`[HARDCODED DUP] Deleting Group ${groupCb.artistName} because Member ${memberCb.artistName} is the actual comeback on ${h.date}`);
             await deleteDoc(doc(db, "comebacks", groupCb.id));
             deleted++;
        }
    }

    console.log(`Deleted ${deleted} duplicate/conflict comebacks.`);
}

run().catch(console.error);
