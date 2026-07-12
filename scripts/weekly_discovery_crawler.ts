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

const stopWords = new Set(["신인", "보이그룹", "걸그룹", "아이돌", "밴드", "가수", "오늘", "내일", "정식", "드디어", "컴백", "데뷔", "신곡", "발매", "발표", "확정", "첫", "미니", "정규", "앨범", "티저", "공개", "음원", "뮤비", "쇼케이스", "출격", "기대", "주목", "화제", "제작", "소속사", "대표", "프로듀서", "합류", "멤버", "공식", "단독", "현장", "종합", "리포트", "인터뷰", "포토", "영상", "왔다", "품고", "돌아온다", "출신", "전격", "뉴스핌", "v", "daum", "net", "com", "co", "kr", "스포츠동아", "스타뉴스", "엑스포츠뉴스", "OSEN", "오센", "뉴스엔", "마이데일리", "스타투데이", "뉴스1", "뉴시스", "디스패치", "TV리포트"]);

function extractLikelyProperNouns(title: string): string[] {
  const candidates = new Set<string>();

  // 1. Words enclosed in quotes
  const quoteRegex = /['"‘“](.*?)['"’”]/g;
  let match;
  while ((match = quoteRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 2. Capitalized English words (e.g. NCT DREAM)
  const engRegex = /([A-Z][a-zA-Z0-9-]*(?:\s+[A-Z][a-zA-Z0-9-]*)*)/g;
  while ((match = engRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 3. Words before comma (often subjects in news titles like "세븐틴, ...")
  const commaRegex = /([가-힣A-Za-z0-9]+)\s*,/g;
  while ((match = commaRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 4. Words ending with subject particles
  const particleRegex = /([가-힣A-Za-z0-9]+)(은|는|이|가)\s+/g;
  while ((match = particleRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 5. Fallback: just look at the very first word in the title after stripping brackets.
  let cleanTitle = title.replace(/\[.*?\]/g, "").trim();
  const firstWord = cleanTitle.split(/\s+/)[0].replace(/['"‘”“’`~!?@#$%^&*_+={}\[\]:;|<>\.\,\/\\…\-]/g, "");
  if (firstWord.length > 1 && !stopWords.has(firstWord)) {
    let cleaned = firstWord;
    const particles = ["으로", "만의", "에서", "부터", "까지", "은", "는", "이", "가", "로", "의", "와", "과", "도", "을", "를", "만"];
    for (const p of particles) {
      if (cleaned.endsWith(p)) {
        cleaned = cleaned.slice(0, -p.length);
        break;
      }
    }
    if (cleaned.length > 1 && !stopWords.has(cleaned)) {
      candidates.add(cleaned);
    }
  }

  return Array.from(candidates);
}

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
    const actualName = $detail('header.sectionPadding h1').text().trim();
    
    // Defense against Bugs Music's fuzzy search returning unrelated artists (e.g. "버스" -> "장범준")
    const isSubstring = actualName.includes(artistName) || artistName.includes(actualName);
    if (!isSubstring) {
      const isGroup = artistTypeStr.includes('그룹');
      const debutYearMatch = artistTypeStr.match(/데뷔 (\d{4})/);
      const debutYear = debutYearMatch ? parseInt(debutYearMatch[1], 10) : 0;
      
      // If not a substring, only accept if it's a group or debuted recently (>= 2020)
      if (!isGroup && debutYear < 2020) {
        return null;
      }
    }

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

  const pendingReviewsSnap = await getDocs(collection(db, 'pending_reviews'));
  const pendingKeys = new Set<string>();
  pendingReviewsSnap.docs.forEach(d => {
    pendingKeys.add(`${d.data().artistName}_${d.data().releaseDate}`);
  });

  const seenCandidates = new Set<string>();
  let newReviewsCount = 0;

  // Pre-sort existing artist keys by length (longest first) to prevent partial matching 
  // (e.g. finding "우주" when the name is "우주소녀")
  const knownArtistNames = Array.from(existingArtistsMap.keys()).sort((a, b) => b.length - a.length);

  for (const item of allNews) {
    const title = item.title || "";
    const releaseDate = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const releaseType = title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single");

    let foundExistingArtist = false;

    // 1. FAST PATH: Check if any KNOWN artist name is directly in the title
    for (const knownName of knownArtistNames) {
      // Robust Korean word boundary matching:
      // Preceded by space, start of string, or punctuation/bracket
      // Followed by space, end of string, punctuation, or common Korean subject/object particles
      const regexStr = `(^|[\\\\s'"\\\\\\[\\\\\\]\\\\(\\\\)⟨⟩«»])` + 
                       knownName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&') + 
                       `([\\\\s'"\\\\\\[\\\\\\]\\\\(\\\\)⟨⟩«»,.?!]|은|는|이|가|를|을|의|로|와|과|$)`;
      const regex = new RegExp(regexStr);

      if (regex.test(title)) {
        const artistId = existingArtistsMap.get(knownName);
        const comebackKey = `${knownName}_${releaseDate}`;
        
        if (!existingComebackKeys.has(comebackKey) && !pendingKeys.has(comebackKey)) {
          logger.info(`🔄 Existing artist ${knownName} is having a comeback! (from: ${title})`);
          const docData = {
            type: 'existing_artist',
            artistName: knownName,
            artistId: artistId,
            releaseDate: releaseDate,
            releaseType: releaseType,
            sourceTitle: title,
            sourceLink: item.link || "",
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, "pending_reviews"), docData);
          newReviewsCount++;
          pendingKeys.add(comebackKey);
        }
        foundExistingArtist = true;
        break; // Found the primary subject, move on (or could allow multiple, but usually 1 main comeback)
      }
    }

    // 2. DISCOVERY PATH: If no known artist was found, look for NEW debuting teams using proper noun heuristics
    if (!foundExistingArtist) {
      const candidates = extractLikelyProperNouns(title);
      
      for (const candidateName of candidates) {
        if (candidateName.length < 2 || seenCandidates.has(candidateName)) {
          continue;
        }
        seenCandidates.add(candidateName);

        const comebackKey = `${candidateName}_${releaseDate}`;
        if (existingComebackKeys.has(comebackKey) || pendingKeys.has(comebackKey)) {
          continue;
        }

        const bugsInfo = await fetchBugsArtistValidation(candidateName);
        if (bugsInfo) {
          logger.info(`✅ Verified NEW artist ${candidateName} on Bugs! (from: ${title})`);
          
          const docData = {
            type: 'new_artist',
            artistName: candidateName,
            artistGender: bugsInfo.gender || 'mixed',
            artistType: bugsInfo.type,
            releaseDate: releaseDate,
            releaseType: releaseType,
            sourceTitle: title,
            sourceLink: item.link || "",
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, "pending_reviews"), docData);
          newReviewsCount++;
          pendingKeys.add(comebackKey);
          break; // Found the new artist, move to next news item
        } else {
          logger.info(`❌ Rejected ${candidateName}: Not found as an active idol/singer on Bugs.`);
        }
        
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (newReviewsCount > 0) {
    logger.info(`Found and sent ${newReviewsCount} new pending reviews to Telegram.`);
  } else {
    logger.info("No new comebacks found to review.");
  }

  logger.info("Weekly Discovery complete.");
  process.exit(0);
}

runWeeklyCrawler().catch(e => {
  logger.error("Weekly Crawler Critical Failure:", e);
  process.exit(1);
});
