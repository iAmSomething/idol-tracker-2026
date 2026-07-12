import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const parser = new Parser();

async function fetchPrecisionNews(artistName: string) {
  const queryStr = encodeURIComponent(`"${artistName}" (트랙리스트 OR 콘셉트 포토 OR 티저 OR 하이라이트 메들리)`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  
  try {
    const feed = await parser.parseURL(url);
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return feed.items
      .filter(item => item.isoDate && new Date(item.isoDate).getTime() > threeDaysAgo)
      .map(item => ({ title: item.title, link: item.link, pubDate: item.pubDate }));
  } catch (e) {
    logger.error(`Error fetching precision news for ${artistName}:`, e);
    return [];
  }
}

async function runDailyCrawler() {
  logger.info("Starting Daily Precision Crawler...");
  
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  
  for (const cDoc of comebacksSnap.docs) {
    const data = cDoc.data();
    
    // Check if released (Date has passed)
    if (data.releaseDate < todayStr && !data.isReleased) {
      logger.info(`[RELEASED] ${data.artistName} comeback date passed (${data.releaseDate}). Scraping final bugs/youtube data...`);
      
      // TODO: Implement actual Bugs/YouTube scraping here. For now, mark as released.
      await updateDoc(doc(db, "comebacks", cDoc.id), {
        isReleased: true,
        // We can add actual bugsAlbumId or youtubeMusicUrl here later
      });
      continue;
    }

    // Check if approaching within 1 week
    if (data.releaseDate >= todayStr && data.releaseDate <= nextWeekStr) {
      logger.info(`[APPROACHING] Fetching precise teaser info for: "${data.artistName}"`);
      const news = await fetchPrecisionNews(data.artistName);
      
      if (news.length > 0) {
        logger.info(`Found ${news.length} new teasers/info for ${data.artistName}!`);
        await updateDoc(doc(db, "comebacks", cDoc.id), {
          lastTeaserUpdate: new Date().toISOString(),
          recentNews: news.slice(0, 3) // Store top 3 latest updates
        });
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  logger.info("Daily Precision Crawl complete.");
  process.exit(0);
}

runDailyCrawler().catch(e => {
  logger.error("Daily Crawler Critical Failure:", e);
  process.exit(1);
});
