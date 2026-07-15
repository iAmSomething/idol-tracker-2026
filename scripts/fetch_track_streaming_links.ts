import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { fetchAllStreamingLinksForTrack } from "./lib/streaming_links_scraper";
import { logger } from "./lib/logger";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc5147da03ef769e59"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper for jitter delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomJitter = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function runBackfill() {
  logger.info("Starting Track-level Streaming Links Backfill...");

  const tracksRef = collection(db, "tracks");
  const snap = await getDocs(tracksRef);

  let processedCount = 0;
  for (const tDoc of snap.docs) {
    const data = tDoc.data();
    
    // Check if it already has streaming links beyond bugs
    const existingLinks = data.streamingLinks || {};
    if (existingLinks.melon || existingLinks.youtubeMusic || existingLinks.appleMusic) {
      // Already processed
      continue;
    }

    if (!data.name || data.name === "TBA") continue;

    logger.info(`Fetching links for Track: [${data.artistName}] ${data.name}...`);
    
    // Pass existing bugs link so we don't lose it
    const newLinks = await fetchAllStreamingLinksForTrack(data.artistName, data.name, existingLinks.bugs);

    if (Object.keys(newLinks).length > 0) {
      await updateDoc(doc(db, "tracks", tDoc.id), {
        streamingLinks: newLinks
      });
      logger.info(`✅ Updated track links for ${data.name}: ${Object.keys(newLinks).join(", ")}`);
      processedCount++;
    } else {
      logger.info(`⚠️ No new links found for ${data.name}`);
    }

    // Delay 3-5 seconds between tracks to avoid API Ban
    const waitTime = randomJitter(3000, 5000);
    logger.info(`Waiting ${waitTime}ms before next track...`);
    await delay(waitTime);
  }

  logger.info(`Track Backfill complete. Updated ${processedCount} tracks.`);
  process.exit(0);
}

runBackfill().catch(e => {
  logger.error("Track Backfill failed:", e);
  process.exit(1);
});
