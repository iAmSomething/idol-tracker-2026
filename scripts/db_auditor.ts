import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function runAudit() {
    console.log("🔍 Running Daily DB Integrity Audit...");
    const comebacksSnap = await getDocs(collection(db, "comebacks"));
    const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    let anomaliesFound = 0;
    
    // 1. Detect Group vs Member conflicts on the same day
    const byDate: Record<string, any[]> = {};
    for (const c of comebacks) {
        if (!byDate[c.releaseDate]) byDate[c.releaseDate] = [];
        byDate[c.releaseDate].push(c);
    }

    for (const date in byDate) {
        const cbs = byDate[date];
        if (cbs.length <= 1) continue;
        
        for (let i = 0; i < cbs.length; i++) {
            for (let j = 0; j < cbs.length; j++) {
                if (i === j) continue;
                const a = cbs[i];
                const b = cbs[j];
                
                // Group vs Member check
                if (b.parentGroupName && b.parentGroupName === a.artistName) {
                    console.log(`🚨 [AUDIT: CONFLICT] Group '${a.artistName}' and Member '${b.artistName}' both have comebacks on ${date}.`);
                    console.log(`   -> Auto-resolving: Deleting Group entry (${a.id})`);
                    await deleteDoc(doc(db, "comebacks", a.id));
                    cbs[i] = null; // Mark deleted
                    anomaliesFound++;
                }

                // Alias exact inclusion check (e.g., 효린 vs 효린(HYOLYN))
                if (a && b && (a.artistName.includes(b.artistName) || b.artistName.includes(a.artistName))) {
                    if (a.artistName !== b.artistName) {
                        let toDelete = a;
                        if (a.artistName.includes("(") && !b.artistName.includes("(")) toDelete = a;
                        else if (b.artistName.includes("(") && !a.artistName.includes("(")) toDelete = b;
                        else if (a.artistName.length > b.artistName.length) toDelete = a;
                        else toDelete = b;
                        
                        console.log(`🚨 [AUDIT: ALIAS] Found duplicate aliases '${a.artistName}' and '${b.artistName}' on ${date}.`);
                        console.log(`   -> Auto-resolving: Deleting '${toDelete.artistName}' (${toDelete.id})`);
                        await deleteDoc(doc(db, "comebacks", toDelete.id));
                        if (toDelete.id === a.id) cbs[i] = null;
                        if (toDelete.id === b.id) cbs[j] = null;
                        anomaliesFound++;
                    }
                }
            }
        }
    }

    // 2. Detect weird names (length < 2 or weird characters)
    for (const c of comebacks) {
        if (!c) continue;
        if (c.artistName.length < 2 || c.artistName.match(/[^가-힣a-zA-Z0-9\s()&]/)) {
             console.log(`🚨 [AUDIT: SUSPICIOUS NAME] Artist name '${c.artistName}' looks suspicious.`);
             // We just flag it, don't auto-delete unless we're sure
             anomaliesFound++;
        }
    }

    console.log(`✅ Audit Complete. Resolved ${anomaliesFound} anomalies.`);
}

runAudit().catch(console.error);
