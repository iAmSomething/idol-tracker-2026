import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db, getActiveArtistsBatch } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, addDoc, getDocs, updateDoc, doc } from "firebase/firestore";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const parser = new Parser();

interface ParsedComeback {
  isComeback: boolean;
  artistName: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  releaseType: "full" | "mini" | "single";
}

async function fetchNewsForArtist(artist: string) {
  const queryStr = encodeURIComponent(`"${artist}" (컴백 OR 신곡 OR 발매)`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  
  try {
    const feed = await parser.parseURL(url);
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return feed.items
      .filter(item => item.isoDate && new Date(item.isoDate).getTime() > threeDaysAgo)
      .map(item => ({ artist, title: item.title, link: item.link, pubDate: item.pubDate }));
  } catch (e) {
    logger.error(`Error fetching news for ${artist}:`, e);
    return [];
  }
}

async function verifyWithKeywords(newsItems: any[]): Promise<ParsedComeback[]> {
  const verified: ParsedComeback[] = [];
  const comebackKeywords = ["컴백", "신곡", "발매", "데뷔", "타이틀곡"];
  const ignoreKeywords = ["루머", "논의", "검토중", "콘서트", "팬미팅", "방송", "예능", "출연", "차트", "OST", "기부", "오에스티", "모델", "발탁", "MC"];

  for (const item of newsItems) {
    const title = item.title || "";
    
    // Check for ignore keywords
    if (ignoreKeywords.some(kw => title.includes(kw))) {
      continue;
    }

    // Check for comeback keywords
    if (comebackKeywords.some(kw => title.includes(kw))) {
      verified.push({
        isComeback: true,
        artistName: item.artist,
        title: title.length > 40 ? title.substring(0, 40) + "..." : title,
        releaseDate: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        releaseType: title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single")
      });
    }
  }

  // Deduplicate by artist to avoid multiple news articles for the same comeback flooding
  const uniqueVerified = [];
  const seen = new Set();
  for (const v of verified) {
    if (!seen.has(v.artistName)) {
      seen.add(v.artistName);
      uniqueVerified.push(v);
    }
  }

  return uniqueVerified;
}

async function runCrawler() {
  logger.info("Starting Auto Crawler (1-Week Approaching Comebacks Only)...");
  
  // Find comebacks happening in the next 7 days
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  const targetArtists = new Set<string>();

  for (const doc of comebacksSnap.docs) {
    const data = doc.data();
    if (data.releaseDate >= todayStr && data.releaseDate <= nextWeekStr) {
      targetArtists.add(data.artistName);
    }
  }

  const artists = Array.from(targetArtists);
  logger.info(`Selected ${artists.length} artists who have a comeback approaching within 1 week.`);

  let allNews = [];
  
  for (const artistName of artists) {
    logger.info(` -> Fetching news for: "${artistName}"`);
    const news = await fetchNewsForArtist(artistName);
    allNews.push(...news);

    await new Promise(r => setTimeout(r, 800));
  }

  logger.info(`Found ${allNews.length} recent news items. Verifying with keywords...`);

  const verifiedComebacks = await verifyWithKeywords(allNews);

  logger.info(`Keyword filtering identified ${verifiedComebacks.length} true comebacks.`);

  if (verifiedComebacks.length > 0) {
    logger.info("Loading all comebacks to optimize queries...");
    const comebacksSnap = await getDocs(collection(db, 'comebacks'));
    const allComebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));
    const comebackKeys = new Set<string>();
    for (const cb of allComebacks) {
      comebackKeys.add(`${cb.artistName}_${cb.title}`);
    }

    logger.info("Loading artists from Firestore to optimize updates...");
    const artistsSnap = await getDocs(collection(db, 'artists'));
    const allArtistsMap = new Map<string, string>(); // name -> docId
    for (const d of artistsSnap.docs) {
      const data = d.data() as any;
      const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
      allArtistsMap.set(name, d.id);
    }

    for (const cb of verifiedComebacks) {
      const cbKey = `${cb.artistName}_${cb.title}`;
      
      if (!comebackKeys.has(cbKey)) {
        logger.info(`New comeback found! ${cb.artistName} - ${cb.title} (${cb.releaseDate})`);
        
        await addDoc(collection(db, "comebacks"), {
          artistName: cb.artistName,
          title: cb.title,
          releaseDate: new Date(cb.releaseDate).toISOString().split('T')[0],
          releaseType: cb.releaseType,
          agencyName: "Unknown",
          imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200",
          createdAt: new Date().toISOString(),
        });
        
        const artistDocId = allArtistsMap.get(cb.artistName);
        if (artistDocId) {
          await updateDoc(doc(db, "artists", artistDocId), {
            recentComeback: {
              title: cb.title,
              date: cb.releaseDate,
              type: cb.releaseType
            }
          });
        }
      } else {
        logger.info(`Comeback already tracked: ${cb.artistName} - ${cb.title}`);
      }
    }
  }

  logger.info("Crawl complete.");
  process.exit(0);
}

runCrawler().catch(e => {
  logger.error("Auto Crawler Critical Failure:", e);
  process.exit(1);
});
