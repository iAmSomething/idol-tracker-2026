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
  const existingArtistsMap = new Map<string, string>();
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
    existingArtistsMap.set(name, d.id);
    if (data.aliases) {
      data.aliases.forEach((a: string) => existingArtistsMap.set(a, d.id));
    }
  });

  const existingComebacksSnap = await getDocs(collection(db, 'comebacks'));
  const existingComebackKeys = new Set<string>();
  existingComebacksSnap.docs.forEach(d => {
    existingComebackKeys.add(`${d.data().artistName}_${d.data().releaseDate}`);
  });

  const seenCandidates = new Set<string>();

  for (const item of allNews) {
    const title = item.title || "";
    // Extremely basic heuristic to extract names before standard delimiters
    // [단독] 아티스트명, 8월 컴백 -> 아티스트명
    const match = title.match(/(?:\[.+?\]\s*)?([가-힣a-zA-Z0-9&]+(?:\s[가-힣a-zA-Z0-9&]+)?)(?:[,\s]+|는|이|가|은).*(컴백|신곡|발매|데뷔)/);
    
    if (match) {
      const candidateName = match[1].trim();
      
      if (candidateName.length < 2 || seenCandidates.has(candidateName)) {
        continue;
      }
      seenCandidates.add(candidateName);

      logger.info(`Candidate artist found in news: ${candidateName} (from: ${title})`);
      
      const releaseDate = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const comebackKey = `${candidateName}_${releaseDate}`;

      if (existingComebackKeys.has(comebackKey)) {
        continue; // Already tracked this exact comeback
      }

      const releaseType = title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single");
      let artistId = existingArtistsMap.get(candidateName);

      if (!artistId) {
        // New artist, verify with Bugs Music
        const bugsInfo = await fetchBugsArtistValidation(candidateName);
        if (bugsInfo) {
          logger.info(`✅ Verified NEW artist ${candidateName} on Bugs!`);
          const artistRef = await addDoc(collection(db, "artists"), {
            name: { ko: candidateName, en: candidateName },
            type: bugsInfo.type,
            gender: bugsInfo.gender || 'mixed',
            createdAt: new Date().toISOString()
          });
          artistId = artistRef.id;
        } else {
          logger.info(`❌ Rejected ${candidateName}: Not found as an active idol/singer on Bugs.`);
          continue;
        }
      } else {
        logger.info(`🔄 Existing artist ${candidateName} is having a comeback!`);
      }

      // Register their comeback
      await addDoc(collection(db, "comebacks"), {
        artistName: candidateName,
        artistId: artistId,
        title: "TBA", // Will be filled by daily precision crawler
        releaseDate: releaseDate,
        releaseType: releaseType,
        agencyName: "Unknown",
        createdAt: new Date().toISOString(),
      });
      existingComebackKeys.add(comebackKey); // prevent dupes in same run
      
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
