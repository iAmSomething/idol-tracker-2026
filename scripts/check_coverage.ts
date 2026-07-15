import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));
async function run() {
  const snap = await getDocs(collection(db, "comebacks"));
  let total = snap.size;
  let bugs = 0, melon = 0, apple = 0, yt = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const links = data.streamingLinks || {};
    if (links.bugs) bugs++;
    if (links.melon) melon++;
    if (links.appleMusic) apple++;
    if (links.youtubeMusic) yt++;
  }
  console.log(`Total Comebacks: ${total}`);
  console.log(`Bugs: ${bugs} (${(bugs/total*100).toFixed(1)}%)`);
  console.log(`Melon: ${melon} (${(melon/total*100).toFixed(1)}%)`);
  console.log(`Apple Music: ${apple} (${(apple/total*100).toFixed(1)}%)`);
  console.log(`YouTube Music: ${yt} (${(yt/total*100).toFixed(1)}%)`);
  process.exit(0);
}
run();
