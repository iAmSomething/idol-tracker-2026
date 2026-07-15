import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { isEmbeddableYouTubeUrl } from "../lib/url-guards";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function runAudit() {
    const isFixMode = process.argv.includes("--fix");
    console.log(`🔍 Running Daily DB Integrity Audit (${isFixMode ? "FIX MODE - Changes will be written to DB" : "DRY RUN MODE - Read-only check"})...`);
    
    const comebacksSnap = await getDocs(collection(db, "comebacks"));
    const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    let anomaliesFound = 0;
    let anomaliesFixed = 0;
    
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
                
                if (!a || !b) continue;

                // Group vs Member check
                if (b.parentGroupName && b.parentGroupName === a.artistName) {
                    console.log(`🚨 [AUDIT: CONFLICT] Group '${a.artistName}' and Member '${b.artistName}' both have comebacks on ${date}.`);
                    anomaliesFound++;
                    if (isFixMode) {
                        console.log(`   -> Deleting Group entry (${a.id})`);
                        await deleteDoc(doc(db, "comebacks", a.id));
                        cbs[i] = null; // Mark deleted
                        anomaliesFixed++;
                    } else {
                        console.log(`   -> [DRY RUN] Would delete Group entry (${a.id})`);
                    }
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
                        anomaliesFound++;
                        if (isFixMode) {
                            console.log(`   -> Deleting '${toDelete.artistName}' (${toDelete.id})`);
                            await deleteDoc(doc(db, "comebacks", toDelete.id));
                            if (toDelete.id === a.id) cbs[i] = null;
                            if (toDelete.id === b.id) cbs[j] = null;
                            anomaliesFixed++;
                        } else {
                            console.log(`   -> [DRY RUN] Would delete '${toDelete.artistName}' (${toDelete.id})`);
                        }
                    }
                }
            }
        }
    }

    // 2. Detect weird names (length < 2 or weird characters)
    for (const c of comebacks) {
        if (!c) continue;
        if (c.artistName.length < 2 || c.artistName.match(/[^가-힣a-zA-Z0-9\s()&]/)) {
             console.log(`🚨 [AUDIT: SUSPICIOUS NAME] Artist name '${c.artistName}' looks suspicious in comeback (${c.id}).`);
             anomaliesFound++;
             // Suspicious names are only flagged, no auto-delete
        }
    }

    // 3. Detect invalid (non-YouTube) URLs in mediaLinks.musicVideo and titleTracks
    for (const c of comebacks) {
        if (!c) continue;
        
        // 3-1. Check mediaLinks.musicVideo
        const mvUrl = c.mediaLinks?.musicVideo;
        if (mvUrl && !isEmbeddableYouTubeUrl(mvUrl)) {
            console.log(`🚨 [AUDIT: INVALID URL] Comeback '${c.artistName} - ${c.albumTitle || c.title}' (${c.id}) has invalid music video URL: "${mvUrl}"`);
            anomaliesFound++;
            if (isFixMode) {
                console.log(`   -> Clearing invalid URL in mediaLinks.musicVideo`);
                await updateDoc(doc(db, "comebacks", c.id), {
                    "mediaLinks.musicVideo": ""
                });
                anomaliesFixed++;
            } else {
                console.log(`   -> [DRY RUN] Would clear invalid URL in mediaLinks.musicVideo`);
            }
        }

        // 3-2. Check titleTracks list
        if (Array.isArray(c.titleTracks)) {
            let tracksUpdated = false;
            const updatedTitleTracks = c.titleTracks.map((t: any) => {
                if (t.musicVideoUrl && !isEmbeddableYouTubeUrl(t.musicVideoUrl)) {
                    console.log(`🚨 [AUDIT: INVALID URL] Comeback '${c.artistName}' (${c.id}) track '${t.name}' has invalid musicVideoUrl: "${t.musicVideoUrl}"`);
                    anomaliesFound++;
                    tracksUpdated = true;
                    return { ...t, musicVideoUrl: "" };
                }
                return t;
            });

            if (tracksUpdated && isFixMode) {
                console.log(`   -> Clearing invalid URLs in titleTracks`);
                await updateDoc(doc(db, "comebacks", c.id), {
                    titleTracks: updatedTitleTracks
                });
                anomaliesFixed++;
            } else if (tracksUpdated) {
                console.log(`   -> [DRY RUN] Would clear invalid URLs in titleTracks`);
            }
        }
    }

    console.log(`\n==================================================`);
    console.log(`✅ Audit Complete. Anomalies Found: ${anomaliesFound}, Anomalies Fixed: ${anomaliesFixed}`);
    console.log(`==================================================`);
}

runAudit().catch(console.error);
