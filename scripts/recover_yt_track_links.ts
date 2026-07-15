import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { fetchYouTubeMusicTrackLink } from "./lib/streaming_links_scraper";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  console.log("Starting YouTube Music track links recovery...");
  const snap = await getDocs(collection(db, "tracks"));
  let count = 0;
  
  for (const d of snap.docs) {
    const data = d.data();
    if (data.streamingLinks && !data.streamingLinks.youtubeMusic) {
      console.log(`Recovering YT Music for track: ${data.artistName} - ${data.title}`);
      const ytLink = await fetchYouTubeMusicTrackLink(data.artistName, data.title);
      
      if (ytLink) {
        console.log(`✅ Found YT Music link for ${data.title}: ${ytLink}`);
        await updateDoc(doc(db, "tracks", d.id), {
          "streamingLinks.youtubeMusic": ytLink
        });
        count++;
      } else {
        console.log(`❌ Still no YT Music link for ${data.title}`);
      }
      // Add a small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  
  console.log(`Done! Successfully recovered YT Music links for ${count} tracks.`);
  process.exit(0);
}
run();
