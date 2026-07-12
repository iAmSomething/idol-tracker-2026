import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const parser = new Parser();

async function fetchBugsArtistValidation(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    const detailUrl = $search('figure.artistInfo a.thumbnail').first().attr('href');
    if (!detailUrl) return null;

    const detailRes = await axios.get(detailUrl, { timeout: 5000 });
    const $detail = cheerio.load(detailRes.data);
    const artistTypeStr = $detail('table.info tbody tr').text().replace(/\s+/g, ' ');
    
    // Check if it's an actor/comedian/irrelevant
    if (artistTypeStr.includes('배우') || artistTypeStr.includes('개그맨') || artistTypeStr.includes('방송인')) {
      return null;
    }

    let gender: "male" | "female" | "mixed" | undefined;
    if (artistTypeStr.includes('(여성)')) gender = 'female';
    else if (artistTypeStr.includes('(남성)')) gender = 'male';
    else if (artistTypeStr.includes('(혼성)')) gender = 'mixed';
    
    let type: "group" | "solo" = artistTypeStr.includes('그룹') ? 'group' : 'solo';

    return { gender, type };
  } catch (e: any) {
    logger.error(`Error validating ${artistName} on Bugs: ${e.message}`);
    return null;
  }
}

async function runWeeklyCrawler() {
  logger.info("Starting Weekly Discovery Crawler...");
  
  // Search specifically for idol/singer comebacks to reduce noise
  const queryStr = encodeURIComponent(`"컴백" OR "데뷔" OR "신곡" (아이돌 OR 걸그룹 OR 보이그룹 OR 밴드 OR 가수)`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  
  let allNews = [];
  try {
    const feed = await parser.parseURL(url);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    allNews = feed.items.filter(item => item.isoDate && new Date(item.isoDate).getTime() > sevenDaysAgo);
  } catch (e) {
    logger.error(`Error fetching weekly news:`, e);
    process.exit(1);
  }

  logger.info(`Found ${allNews.length} news items in the last 7 days.`);

  // Load existing artists
  const artistsSnap = await getDocs(collection(db, 'artists'));
  const existingArtists = new Set<string>();
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
    existingArtists.add(name);
    if (data.aliases) {
      data.aliases.forEach((a: string) => existingArtists.add(a));
    }
  });

  const seenCandidates = new Set<string>();

  for (const item of allNews) {
    const title = item.title || "";
    // Extremely basic heuristic to extract names before standard delimiters
    // [단독] 아티스트명, 8월 컴백 -> 아티스트명
    const match = title.match(/(?:\[.+?\]\s*)?([가-힣a-zA-Z0-9&]+(?:\s[가-힣a-zA-Z0-9&]+)?)(?:[,\s]+|는|이|가|은).*(컴백|신곡|발매|데뷔)/);
    
    if (match) {
      const candidateName = match[1].trim();
      
      if (candidateName.length < 2 || seenCandidates.has(candidateName) || existingArtists.has(candidateName)) {
        continue;
      }
      seenCandidates.add(candidateName);

      logger.info(`Candidate new artist found in news: ${candidateName} (from: ${title})`);
      
      // Verify with Bugs Music to ensure it's not a random word or actor
      const bugsInfo = await fetchBugsArtistValidation(candidateName);
      
      if (bugsInfo) {
        logger.info(`✅ Verified ${candidateName} as a real music artist! Gender: ${bugsInfo.gender}, Type: ${bugsInfo.type}`);
        
        // Register new artist
        const artistRef = await addDoc(collection(db, "artists"), {
          name: { ko: candidateName, en: candidateName },
          type: bugsInfo.type,
          gender: bugsInfo.gender || 'mixed',
          createdAt: new Date().toISOString()
        });

        // Register their comeback
        const releaseType = title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single");
        await addDoc(collection(db, "comebacks"), {
          artistName: candidateName,
          artistId: artistRef.id,
          title: "TBA", // Will be filled by daily precision crawler
          releaseDate: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          releaseType: releaseType,
          agencyName: "Unknown",
          createdAt: new Date().toISOString(),
        });
      } else {
        logger.info(`❌ Rejected ${candidateName}: Not found as an active idol/singer on Bugs.`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  logger.info("Weekly Discovery complete.");
  process.exit(0);
}

runWeeklyCrawler().catch(e => {
  logger.error("Weekly Crawler Critical Failure:", e);
  process.exit(1);
});
