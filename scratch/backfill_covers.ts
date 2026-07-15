import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, orderBy, limit } from "firebase/firestore";
import { scrapeBugsLatestAlbums } from "./scripts/lib/bugs_scraper";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: "AIzaSyAaQR2HtiH-KN8hz5aIr4iNn0eWuTsg_yE",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Scraping latest bugs albums to get covers...");
  const bugsAlbums = await scrapeBugsLatestAlbums();
  
  console.log("Fetching recent Firestore comebacks without covers...");
  const comebacksRef = collection(db, "comebacks");
  const snap = await getDocs(query(comebacksRef));
  
  let updatedCount = 0;
  
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    // Only target those missing albumCoverUrl
    if (!data.albumCoverUrl) {
      // Find matching album from bugs
      const bugsMatch = bugsAlbums.find(a => a.artistName === data.artistName && a.title === data.title);
      if (bugsMatch && bugsMatch.coverUrl) {
        console.log(`Updating cover for ${data.artistName} - ${data.title}: ${bugsMatch.coverUrl}`);
        await updateDoc(doc(db, "comebacks", docSnap.id), {
          albumCoverUrl: bugsMatch.coverUrl,
          // Set a fallback for recent news so it doesn't look completely empty if the UI expects it, though we don't have news here.
        });
        updatedCount++;
      } else {
        console.log(`No Bugs match found for ${data.artistName} - ${data.title} to update cover.`);
      }
    }
  }
  
  console.log(`Successfully backfilled covers for ${updatedCount} comebacks.`);
  process.exit(0);
}

run().catch(console.error);
