import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../app/firebase";
import Parser from "rss-parser";

const parser = new Parser();

async function fillSourceLinks() {
  console.log("Fetching comebacks...");
  const snap = await getDocs(collection(db, "comebacks"));
  
  let updatedCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    // Only update if not released AND no sourceLink
    if (!data.isReleased && (!data.sourceLink || data.sourceLink === "")) {
      const artistName = data.artistName;
      console.log(`[${artistName}] Fetching source link...`);
      
      const queryStr = encodeURIComponent(`"${artistName}" ("컴백" OR "데뷔" OR "신곡")`);
      const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
      
      try {
        const feed = await parser.parseURL(url);
        if (feed.items && feed.items.length > 0) {
          const firstLink = feed.items[0].link;
          console.log(`   -> Found link: ${firstLink}`);
          
          await updateDoc(doc(db, "comebacks", d.id), {
            sourceLink: firstLink
          });
          updatedCount++;
        } else {
          console.log(`   -> No news found for ${artistName}.`);
        }
      } catch (e: any) {
        console.error(`   -> Error fetching news for ${artistName}: ${e.message}`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`Done! Updated ${updatedCount} comebacks.`);
}

fillSourceLinks().catch(console.error);
