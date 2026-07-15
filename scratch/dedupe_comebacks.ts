import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dedupe() {
  const snap = await getDocs(collection(db, "comebacks"));
  const comebacksByArtist = new Map<string, any[]>();
  
  snap.docs.forEach(d => {
    const data = d.data();
    data.id = d.id;
    if (!comebacksByArtist.has(data.artistName)) comebacksByArtist.set(data.artistName, []);
    comebacksByArtist.get(data.artistName)!.push(data);
  });

  let deletedCount = 0;
  let updatedCount = 0;

  for (const [artist, comebacks] of comebacksByArtist.entries()) {
    if (comebacks.length <= 1) continue;
    
    // Sort by createdAt descending so we keep the newest logic if needed, 
    // actually let's sort by date so we process chronological
    comebacks.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

    const merged = new Set<string>();

    for (let i = 0; i < comebacks.length; i++) {
      if (merged.has(comebacks[i].id)) continue;
      
      const primary = comebacks[i];
      let updates: any = {};
      
      for (let j = i + 1; j < comebacks.length; j++) {
        if (merged.has(comebacks[j].id)) continue;
        const secondary = comebacks[j];
        
        // Check if they are within 30 days or one is TBA
        const primaryIsTBA = primary.releaseDate.includes("TBA") || primary.isTba;
        const secondaryIsTBA = secondary.releaseDate.includes("TBA") || secondary.isTba;
        
        let shouldMerge = false;
        
        if (primaryIsTBA || secondaryIsTBA) {
            shouldMerge = true;
        } else {
            const date1 = new Date(primary.releaseDate);
            const date2 = new Date(secondary.releaseDate);
            const diffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 3600 * 24);
            if (diffDays <= 30) {
                shouldMerge = true;
            }
        }

        if (shouldMerge) {
            console.log(`Merging ${artist}: ${secondary.id} (${secondary.releaseDate}) into ${primary.id} (${primary.releaseDate})`);
            
            // Resolve Date: specific > TBA, earlier > later (usually specific date is earlier than end-of-month TBA)
            let bestDate = primary.releaseDate;
            if (primaryIsTBA && !secondaryIsTBA) {
                bestDate = secondary.releaseDate;
            } else if (!primaryIsTBA && !secondaryIsTBA) {
                // If both are specific, maybe keep the most recent? Or the earliest? Let's keep earliest.
                if (secondary.releaseDate < primary.releaseDate) bestDate = secondary.releaseDate;
            }
            if (bestDate !== primary.releaseDate) updates.releaseDate = bestDate;

            // Resolve Title: non-TBA > TBA
            if ((primary.title === "TBA" || !primary.title) && secondary.title && secondary.title !== "TBA") {
                updates.title = secondary.title;
                primary.title = secondary.title;
            }

            // Resolve Type
            if ((primary.releaseType === "unknown" || !primary.releaseType) && secondary.releaseType && secondary.releaseType !== "unknown") {
                updates.releaseType = secondary.releaseType;
                primary.releaseType = secondary.releaseType;
            }

            // Album Cover
            if (!primary.albumCoverUrl && secondary.albumCoverUrl) {
                updates.albumCoverUrl = secondary.albumCoverUrl;
                primary.albumCoverUrl = secondary.albumCoverUrl;
            }

            // Recent News
            const allNews = [...(primary.recentNews || []), ...(secondary.recentNews || [])];
            const uniqueNews = [];
            const seenLinks = new Set();
            for (const n of allNews) {
                if (!seenLinks.has(n.link)) {
                    seenLinks.add(n.link);
                    uniqueNews.push(n);
                }
            }
            if (uniqueNews.length > (primary.recentNews?.length || 0)) {
                updates.recentNews = uniqueNews.slice(0, 5);
                primary.recentNews = updates.recentNews;
            }
            
            // Mark secondary as merged and delete
            merged.add(secondary.id);
            await deleteDoc(doc(db, "comebacks", secondary.id));
            deletedCount++;
        }
      }
      
      if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, "comebacks", primary.id), updates);
          updatedCount++;
      }
    }
  }
  
  console.log(`Deduplication complete. Deleted ${deletedCount} duplicates, Updated ${updatedCount} primaries.`);
}
dedupe().catch(console.error);
