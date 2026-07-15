import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { searchNaverNews } from "../scripts/lib/naver_news_scraper";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Starting retroactive news enrichment...");
  const snap = await getDocs(collection(db, "comebacks"));
  const todayStr = new Date().toISOString().split('T')[0];

  let updatedCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    
    // Only process future comebacks or TBA
    if (data.releaseDate >= todayStr || data.releaseDate.includes("TBA")) {
      const updates: any = {};

      if (data.isReleased === undefined) {
        updates.isReleased = false;
      }

      // Force re-scrape to clear out any past polluted data
      console.log(`Searching Naver for ${data.artistName} (${data.releaseDate})...`);
      try {
        const queryStr = `"${data.artistName}" 컴백 OR 신곡`;
        let newsItems = await searchNaverNews(queryStr, 10);
        
        // Strict local filtering
        newsItems = newsItems.filter((n: any) => {
            const titleUpper = n.title.toUpperCase();
            const mainName = data.artistName.split('(')[0].trim().toUpperCase();
            const aliasMatch = data.artistName.match(/\((.*?)\)/);
            const aliasName = aliasMatch ? aliasMatch[1].toUpperCase() : null;
            return titleUpper.includes(mainName) || (aliasName && titleUpper.includes(aliasName));
        }).slice(0, 3);
        
        if (newsItems && newsItems.length > 0) {
           updates.recentNews = newsItems.map((n: any) => ({ title: n.title, link: n.link, pubDate: n.pubDate }));
           console.log(`  -> Found ${newsItems.length} matching news items.`);
           
           const { scrapeNaverNewsContent } = require("../scripts/lib/naver_news_scraper");
           // Try to get summary from the first valid news item
           const scraped = await scrapeNaverNewsContent(newsItems[0].link, newsItems[0].pubDate, data.artistName);
           if (scraped && scraped.summary) {
               updates.aiSummary = scraped.summary;
               console.log(`  -> Extracted summary: ${scraped.summary.substring(0, 30)}...`);
           } else {
               updates.aiSummary = ""; // Clear bad summary
           }
        } else {
           updates.recentNews = [];
           updates.aiSummary = "";
           console.log(`  -> No strictly matching news found.`);
        }
      } catch(e) {
        console.error(`  -> Failed to enrich for ${data.artistName}:`, e);
      }
      
      // Sleep to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));

      if (Object.keys(updates).length > 0) {
         await updateDoc(doc(db, "comebacks", d.id), updates);
         updatedCount++;
      }
    }
  }

  console.log(`Enrichment complete. Updated ${updatedCount} future comebacks.`);
}

run().catch(console.error);
