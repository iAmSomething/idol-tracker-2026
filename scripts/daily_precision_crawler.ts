import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import axios from "axios";
import * as cheerio from "cheerio";

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

async function verifyBugsAlbum(artistName: string, expectedReleaseDate: string) {
  try {
    const query = artistName;
    const url = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { timeout: 5000 });
    const $ = cheerio.load(res.data);
    
    // Check top 3 albums to see if any match the artist name roughly
    let foundAlbum = null;
    $("div#albumList table.list.albumList tbody tr").slice(0, 3).each((i, el) => {
      const rowArtist = $(el).find("p.artist a").text().trim();
      if (rowArtist.includes(artistName) || artistName.includes(rowArtist)) {
        foundAlbum = {
          albumId: $(el).attr("albumid"),
          title: $(el).find("p.title a").text().trim(),
          coverUrl: $(el).find("a.thumbnail img").attr("src"),
          releaseDateStr: $(el).find("time").text().trim() // Sometimes present
        };
        return false; // break loop
      }
    });

    return foundAlbum;
  } catch (e) {
    logger.error(`Bugs album search error for ${artistName}:`, e);
    return null;
  }
}

async function runDailyCrawler() {
  logger.info("Starting Daily Precision Crawler...");
  
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const pastWeek = new Date();
  pastWeek.setDate(today.getDate() - 7);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  const pastWeekStr = pastWeek.toISOString().split('T')[0];

  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  
  for (const cDoc of comebacksSnap.docs) {
    const data = cDoc.data();
    
    // Check if released (Date has passed or is today)
    if (data.releaseDate !== "TBA" && data.releaseDate <= todayStr && !data.isReleased) {
      // If the date is older than 1 week and still not verified, it's a fake/cancelled comeback. Delete it without calling Bugs API.
      if (data.releaseDate < pastWeekStr) {
        logger.info(`❌ [STALE] Comeback for ${data.artistName} (${data.releaseDate}) is older than 1 week. Deleting to save API calls.`);
        await deleteDoc(doc(db, "comebacks", cDoc.id));
        continue;
      }

      logger.info(`[RELEASED] ${data.artistName} comeback date passed (${data.releaseDate}). Scraping final bugs data...`);
      
      const albumData = await verifyBugsAlbum(data.artistName, data.releaseDate);
      if (albumData) {
        logger.info(`✅ Found real album for ${data.artistName}: ${albumData.title}`);
        await updateDoc(doc(db, "comebacks", cDoc.id), {
          isReleased: true,
          title: albumData.title,
          albumCoverUrl: albumData.coverUrl || "",
          bugsAlbumId: albumData.albumId || ""
        });
      } else {
        logger.info(`❌ Album not found for ${data.artistName}. Deleting fake/cancelled comeback.`);
        await deleteDoc(doc(db, "comebacks", cDoc.id));
      }
      
      await new Promise(r => setTimeout(r, 1000));
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
