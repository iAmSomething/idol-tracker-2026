import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import axios from "axios";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getYouTubeVideoTitle(url: string): Promise<string | null> {
    try {
        const res = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
            timeout: 5000
        });
        return res.data.title;
    } catch (e) {
        return null;
    }
}

async function run() {
    console.log("Starting deep MV Validation cleanup (including tracks)...");
    const snap = await getDocs(collection(db, "comebacks"));
    let invalidCount = 0;
    
    for (const d of snap.docs) {
        const data = d.data();
        
        let mvUrlsToTest = new Set<string>();
        if (data.mediaLinks?.musicVideo) mvUrlsToTest.add(data.mediaLinks.musicVideo);
        
        const tracksQuery = query(collection(db, "tracks"), where("comebackId", "==", d.id));
        const tracksSnap = await getDocs(tracksQuery);
        let tracksData = tracksSnap.docs.map(t => ({ id: t.id, ...t.data() } as any));
        
        for (const t of tracksData) {
            if (t.musicVideoUrl) mvUrlsToTest.add(t.musicVideoUrl);
        }

        for (const url of mvUrlsToTest) {
            if (!url.includes("youtube.com") && !url.includes("youtu.be")) continue;
            
            const mvTitleRaw = await getYouTubeVideoTitle(url);
            if (!mvTitleRaw) {
                // Ignore if it's 404 or deleted
                continue;
            }
            
            const mvTitleClean = mvTitleRaw.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            let isValidMV = false;
            
            const titleTracks = tracksData.filter((t: any) => t.isTitle);
            for (const t of titleTracks) {
                const trackClean = (t.title || t.name || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
                if (trackClean.length > 1 && mvTitleClean.includes(trackClean)) {
                    isValidMV = true; break;
                }
            }
            if (!isValidMV) {
                for (const t of tracksData) {
                    const trackClean = (t.title || t.name || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
                    if (trackClean.length > 1 && mvTitleClean.includes(trackClean)) {
                        isValidMV = true; break;
                    }
                }
            }
            if (!isValidMV && tracksData.length === 0) {
                const albumClean = data.title?.toLowerCase().replace(/[^a-z0-9가-힣]/g, '') || "";
                if (albumClean.length > 1 && mvTitleClean.includes(albumClean)) {
                    isValidMV = true;
                }
            }
            
            if (!isValidMV) {
                console.log(`[INVALID MV] Artist: ${data.artistName} | Album: ${data.title}`);
                console.log(`  -> Title: ${mvTitleRaw}`);
                console.log(`  -> URL: ${url}`);
                
                if (data.mediaLinks?.musicVideo === url) {
                    await updateDoc(doc(db, "comebacks", d.id), { "mediaLinks.musicVideo": "" });
                }
                for (const t of tracksData) {
                    if (t.musicVideoUrl === url) {
                        await updateDoc(doc(db, "tracks", t.id), { "musicVideoUrl": "" });
                    }
                }
                invalidCount++;
            }
            
            await sleep(50);
        }
    }
    
    console.log(`Cleanup complete. Cleared ${invalidCount} invalid MVs.`);
}

run().catch(console.error);
