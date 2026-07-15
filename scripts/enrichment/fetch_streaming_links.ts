import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { fetchAllStreamingLinks } from "./lib/streaming_links_scraper";
import { logger } from "./lib/logger";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc5147da03ef769e59"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runBackfill() {
  logger.info("Starting Streaming Links Backfill...");

  const comebacksRef = collection(db, "comebacks");
  const q = query(comebacksRef, where("isReleased", "==", true));
  const snap = await getDocs(q);

  let processedCount = 0;
  for (const cDoc of snap.docs) {
    const data = cDoc.data();
    
    // Process all comebacks, but skip those that already have all major streaming links


    const existingLinks = data.streamingLinks || {};
    if (Object.keys(existingLinks).length >= 2 && existingLinks.melon && existingLinks.youtubeMusic && existingLinks.appleMusic) {
      continue;
    }

    if ((!data.title || data.title === "TBA") && (!data.albumTitle || data.albumTitle === "TBA")) continue;

    logger.info(`Fetching links for [${data.artistName}] ${data.title} (${data.releaseDate})...`);
    
    const bugsLink = data.bugsAlbumId ? `https://music.bugs.co.kr/album/${data.bugsAlbumId}` : existingLinks.bugs;
    const albumTitleToSearch = data.albumTitle || data.title;
    
    const newLinks = await fetchAllStreamingLinks(data.artistName, albumTitleToSearch, bugsLink);

    if (Object.keys(newLinks).length > 0) {
      await updateDoc(doc(db, "comebacks", cDoc.id), {
        streamingLinks: newLinks
      });
      logger.info(`✅ Updated links for ${data.title}: ${Object.keys(newLinks).join(", ")}`);
      processedCount++;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  logger.info(`Backfill complete. Updated ${processedCount} comebacks.`);
  process.exit(0);
}

runBackfill().catch(e => {
  logger.error("Backfill failed:", e);
  process.exit(1);
});
