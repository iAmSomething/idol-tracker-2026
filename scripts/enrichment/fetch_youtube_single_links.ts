import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { fetchAllStreamingLinks } from "../lib/streaming_links_scraper";

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.releaseType === "single" && !data.streamingLinks?.youtubeMusic) {
      console.log(`Fetching YT Music for single: ${data.artistName} - ${data.title}`);
      const newLinks = await fetchAllStreamingLinks(data.artistName, data.title, data.streamingLinks?.bugs, "single");
      if (newLinks.youtubeMusic) {
        console.log(`✅ Found YT Music link for ${data.title}: ${newLinks.youtubeMusic}`);
        await updateDoc(doc(db, "comebacks", d.id), {
          "streamingLinks.youtubeMusic": newLinks.youtubeMusic
        });
        count++;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.log(`Done! Recovered ${count} single albums.`);
  process.exit(0);
}
run();
