import * as path from "path";
import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { fetchYouTubeCommunityInfo } from "./lib/youtube_scraper";
import { searchNaverNews, scrapeNaverNewsContent } from "./lib/naver_news_scraper";
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { fetchBugsArtistValidation } from "./lib/bugs_scraper";
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const stopWords = new Set(["신인", "보이그룹", "걸그룹", "아이돌", "밴드", "가수", "오늘", "내일", "정식", "드디어", "컴백", "데뷔", "신곡", "발매", "발표", "확정", "첫", "미니", "정규", "앨범", "티저", "공개", "음원", "뮤비", "쇼케이스", "출격", "기대", "주목", "화제", "제작", "소속사", "대표", "프로듀서", "합류", "멤버", "공식", "단독", "현장", "종합", "리포트", "인터뷰", "포토", "영상", "왔다", "품고", "돌아온다", "출신", "전격", "뉴스핌", "v", "daum", "net", "com", "co", "kr", "스포츠동아", "스타뉴스", "엑스포츠뉴스", "OSEN", "오센", "뉴스엔", "마이데일리", "스타투데이", "뉴스1", "뉴시스", "디스패치", "TV리포트"]);

function extractReleaseDate(title: string): string {
  const exactDateMatch = title.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (exactDateMatch) {
    const month = exactDateMatch[1].padStart(2, '0');
    const day = exactDateMatch[2].padStart(2, '0');
    return `2026-${month}-${day}`;
  }
  
  const monthMatch = title.match(/(\d{1,2})월/);
  if (monthMatch) {
    const month = monthMatch[1].padStart(2, '0');
    return `2026-${month}-TBA`;
  }

  if (title.includes("하반기")) return "2026-H2-TBA";
  if (title.includes("상반기")) return "2026-H1-TBA";
  if (title.includes("내달") || title.includes("다음달")) return "NextMonth-TBA";
  
  return "TBA";
}

function extractLikelyProperNouns(title: string): string[] {
  const candidates = new Set<string>();

  const quoteRegex = /['"‘“](.*?)['"’”]/g;
  let match;
  while ((match = quoteRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  const engRegex = /([A-Z][a-zA-Z0-9-]*(?:\s+[A-Z][a-zA-Z0-9-]*)*)/g;
  while ((match = engRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  const commaRegex = /([가-힣A-Za-z0-9]+)\s*,/g;
  while ((match = commaRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  const particleRegex = /([가-힣A-Za-z0-9]+)(은|는|이|가)\s+/g;
  while ((match = particleRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

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

// fetchBugsArtistValidation moved to scripts/lib/bugs_scraper.ts

async function runWeeklyCrawler() {
  logger.info("Starting Weekly Discovery Crawler with Naver News API...");
  
  const allNews = await searchNaverNews("아이돌 컴백", 100);
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentNews = allNews.filter(item => new Date(item.pubDate).getTime() > sevenDaysAgo);

  logger.info(`Found ${recentNews.length} relevant news items in the last 7 days.`);

  // Load existing artists
  const artistsSnap = await getDocs(collection(db, 'artists'));
  const existingArtistsMap = new Map<string, any>();
  const artistYoutubeMap = new Map<string, string>(); 
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const artistObj = { id: d.id, ...data };
    const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
    existingArtistsMap.set(name, artistObj);
    const ytUrl = data.socialLinks?.youtube || data.agency?.youtubeUrl;
    if (ytUrl) artistYoutubeMap.set(name, ytUrl);
    if (data.aliases) {
      data.aliases.forEach((a: string) => {
        existingArtistsMap.set(a, artistObj);
        if (ytUrl) artistYoutubeMap.set(a, ytUrl);
      });
    }
  });

  const existingComebacksSnap = await getDocs(collection(db, 'comebacks'));
  const existingComebackKeys = new Set<string>();
  const artistComebackDates = new Map<string, any[]>();

  existingComebacksSnap.docs.forEach(d => {
    const data = d.data();
    existingComebackKeys.add(`${data.artistName}_${data.releaseDate}`);
    if (!artistComebackDates.has(data.artistName)) artistComebackDates.set(data.artistName, []);
    artistComebackDates.get(data.artistName)!.push({ id: d.id, ...data });
  });

  function findMatchingComeback(artistName: string, date: string): any | null {
    const comebacks = artistComebackDates.get(artistName);
    if (!comebacks) return null;
    
    if (date.includes("TBA")) {
         const todayStr = new Date().toISOString().split('T')[0];
         return comebacks.find(c => c.releaseDate.includes("TBA") || c.releaseDate >= todayStr) || null;
    }
    
    const newDateObj = new Date(date);
    for (const c of comebacks) {
        if (c.releaseDate.includes("TBA")) return c; 
        const oldDateObj = new Date(c.releaseDate);
        if (Math.abs(oldDateObj.getTime() - newDateObj.getTime()) <= 14 * 24 * 60 * 60 * 1000) return c;
    }
    return null;
  }

  function addComebackDate(artistName: string, date: string, docData: any, docId: string) {
    if (!artistComebackDates.has(artistName)) artistComebackDates.set(artistName, []);
    artistComebackDates.get(artistName)!.push({ id: docId, ...docData, releaseDate: date });
    existingComebackKeys.add(`${artistName}_${date}`);
  }

  const seenCandidates = new Set<string>();
  let newReviewsCount = 0;

  const knownArtistNames = Array.from(existingArtistsMap.keys()).sort((a, b) => b.length - a.length);

  for (const item of recentNews) {
    const title = item.title;
    
    // Scrape article body for accurate info!
    const scrapedData = await scrapeNaverNewsContent(item.link, item.pubDate);
    if (!scrapedData) continue; // Skip non-entertain articles

    const releaseDate = scrapedData.releaseDate || extractReleaseDate(title);
    const releaseType = scrapedData.releaseType || (title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single"));
    let albumCoverUrl = scrapedData.officialImageUrl || "";
    const artistTypeFromArticle = scrapedData.artistType; // unit, solo, group, band

    // PAST COMEBACK FILTER: 7일 이상 지난 과거 컴백만 스킵 (어제/오늘 발매된 누락건은 포함시키기 위함)
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (releaseDate !== "TBA" && !releaseDate.includes("TBA") && releaseDate < sevenDaysAgoStr) {
      continue;
    }
    // "발매했다" 등의 과거형 제목이어도, 7일 이내 발매건이라면 스킵하지 않음
    if (/(컴백했다|성료|마무리)/.test(title)) { // '발매했다', '데뷔했다', '공개했다', '돌아왔다'는 허용
      continue;
    }

    if (scrapedData.isMusicComeback === false) {
      console.log(`[SKIP] Not a music comeback: ${title}`);
      continue;
    }

    let foundExistingArtist = false;
    let candidates = extractLikelyProperNouns(title);
    if (scrapedData.artistName && scrapedData.artistName !== "null" && scrapedData.artistName !== "TBA" && scrapedData.artistName.length > 1) {
        candidates = [scrapedData.artistName];
        logger.info(`🤖 Qwen extracted exact artist: ${scrapedData.artistName}`);
    } else {
        logger.info(`🤖 Qwen missed artist, fallback to regex candidates: ${candidates.join(', ')}`);
    }
    
    // 1. DISCOVERY PATH: Existing Artists
    for (const candidate of candidates) {
          const search = candidate.toLowerCase().replace(/\s+/g, '');
          
          let artistObj = null;
          let knownName = "";
          // exact normalized match first
          for (const [key, obj] of existingArtistsMap.entries()) {
             if (key.toLowerCase().replace(/\s+/g, '') === search) {
                 artistObj = obj;
                 knownName = key;
                 break;
             }
          }
          // if not found, try includes
          if (!artistObj) {
            for (const [key, obj] of existingArtistsMap.entries()) {
               const normKey = key.toLowerCase().replace(/\s+/g, '');
               if (normKey.length > 2 && search.length > 2 && (normKey.includes(search) || search.includes(normKey))) {
                   artistObj = obj;
                   knownName = key;
                   break;
               }
            }
          }

          if (artistObj) {
            const artistId = artistObj.id;
            
            const comebackKey = `${knownName}_${releaseDate}`;
        const matchingCb = findMatchingComeback(knownName, releaseDate);
        
        if (!matchingCb && !existingComebackKeys.has(comebackKey)) {
          logger.info(`🔄 Existing artist ${knownName} is having a comeback!`);
          
          let enrichedDate = releaseDate;
          let enrichedType = releaseType;
          let enrichedTitle = "";
          
          if (releaseDate === "TBA" || releaseDate.includes("TBA")) {
            const officialYtUrl = artistYoutubeMap.get(knownName);
            const ytInfo = await fetchYouTubeCommunityInfo(knownName, officialYtUrl);
            if (ytInfo) {
              if (ytInfo.releaseDate) enrichedDate = ytInfo.releaseDate;
              if (ytInfo.releaseType) enrichedType = ytInfo.releaseType;
              if (ytInfo.title) enrichedTitle = ytInfo.title;
              if (ytInfo.albumCoverUrl && !albumCoverUrl) albumCoverUrl = ytInfo.albumCoverUrl;
              logger.info(`📺 YouTube enriched ${knownName}: date=${enrichedDate}, type=${enrichedType}, title=${enrichedTitle}`);
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          const docData: any = {
            artistName: knownName,
            artistId: artistId,
            artistGender: artistObj.gender || "mixed",
            artistType: artistObj.type || "unknown",
            title: enrichedTitle || "TBA",
            releaseDate: enrichedDate,
            releaseType: enrichedType,
            agencyName: artistObj.agencyName || "Unknown",
            isReleased: false,
            sourceTitle: title,
            sourceLink: item.link,
            createdAt: new Date().toISOString(),
            recentNews: [{ title: item.title, link: item.link, pubDate: item.pubDate }]
          };
          if (artistObj.parentGroupName) docData.parentGroupName = artistObj.parentGroupName;
          if (artistObj.parentGroupId) docData.parentGroupId = artistObj.parentGroupId;
          if (albumCoverUrl) docData.albumCoverUrl = albumCoverUrl;
          if (scrapedData.summary) docData.aiSummary = scrapedData.summary;

          // Double check after enrichment
          const postEnrichMatch = findMatchingComeback(knownName, enrichedDate);
          if (postEnrichMatch || existingComebackKeys.has(`${knownName}_${enrichedDate}`)) {
             logger.info(`Skipping duplicate after enrichment: ${knownName}_${enrichedDate}`);
             if (postEnrichMatch) {
                // Enrich it instead
                const updates: any = {};
                if (!postEnrichMatch.recentNews) postEnrichMatch.recentNews = [];
                if (!postEnrichMatch.recentNews.some((n: any) => n.link === item.link)) {
                    postEnrichMatch.recentNews.unshift({ title: item.title, link: item.link, pubDate: item.pubDate });
                    updates.recentNews = postEnrichMatch.recentNews.slice(0, 5);
                }
                if (scrapedData.summary && !postEnrichMatch.aiSummary) {
                    updates.aiSummary = scrapedData.summary;
                }
                if (Object.keys(updates).length > 0) {
                    await updateDoc(doc(db, "comebacks", postEnrichMatch.id), updates);
                }
             }
             addComebackDate(knownName, releaseDate, docData, postEnrichMatch?.id || "");
             foundExistingArtist = true;
             break;
          }

          const newDocRef = await addDoc(collection(db, "comebacks"), docData);
          newReviewsCount++;
          addComebackDate(knownName, releaseDate, docData, newDocRef.id);
          addComebackDate(knownName, enrichedDate, docData, newDocRef.id);
        } else if (matchingCb) {
          // ENRICH EXISTING
          let updates: any = {};
          if (matchingCb.releaseDate.includes("TBA") && !releaseDate.includes("TBA")) {
              updates.releaseDate = releaseDate;
          }
          if (matchingCb.releaseType === "unknown" && releaseType && releaseType !== "unknown") {
              updates.releaseType = releaseType;
          }
          if (!matchingCb.albumCoverUrl && albumCoverUrl) {
              updates.albumCoverUrl = albumCoverUrl;
          }
          
          if (!matchingCb.recentNews) matchingCb.recentNews = [];
          if (!matchingCb.recentNews.some((n: any) => n.link === item.link)) {
              matchingCb.recentNews.unshift({ title: item.title, link: item.link, pubDate: item.pubDate });
              updates.recentNews = matchingCb.recentNews.slice(0, 5);
          }
          if (scrapedData.summary && !matchingCb.aiSummary) {
              updates.aiSummary = scrapedData.summary;
          }

          if (Object.keys(updates).length > 0) {
              logger.info(`📝 Enriching existing comeback for ${knownName}: ${JSON.stringify(updates)}`);
              await updateDoc(doc(db, "comebacks", matchingCb.id), updates);
              Object.assign(matchingCb, updates);
          }
        }
        foundExistingArtist = true;
        break;
      }
    }

    // 2. DISCOVERY PATH: New Artists
    if (!foundExistingArtist) {
      for (const candidateName of candidates) {
        const search = candidateName.toLowerCase().replace(/\s+/g, '');
        const blocklist = ["sm", "jyp", "yg", "hybe", "bighit", "smtown", "cube", "starship", "fnc", "pledis", "sourcemusic", "ador", "beliftlab", "kakao", "cj", "mbk", "dsp", "wm", "woollim", "rbw", "pnation", "mystic", "fantagio", "antenna", "smentertainment", "jypentertainment", "ygentertainment", "bighitmusic"];
        if (blocklist.includes(search)) {
          logger.info(`🚨 [BLOCKLIST] Skipping blocked name: ${candidateName}`);
          continue;
        }

        if (candidateName.length < 2 || seenCandidates.has(candidateName)) {
          continue;
        }
        seenCandidates.add(candidateName);

        const comebackKey = `${candidateName}_${releaseDate}`;
        const matchingCb = findMatchingComeback(candidateName, releaseDate);
        
        if (matchingCb) {
          // ENRICH EXISTING
          let updates: any = {};
          if (matchingCb.releaseDate.includes("TBA") && !releaseDate.includes("TBA")) {
              updates.releaseDate = releaseDate;
          }
          if (matchingCb.releaseType === "unknown" && releaseType && releaseType !== "unknown") {
              updates.releaseType = releaseType;
          }
          if (!matchingCb.albumCoverUrl && albumCoverUrl) {
              updates.albumCoverUrl = albumCoverUrl;
          }
          
          if (!matchingCb.recentNews) matchingCb.recentNews = [];
          if (!matchingCb.recentNews.some((n: any) => n.link === item.link)) {
              matchingCb.recentNews.unshift({ title: item.title, link: item.link, pubDate: item.pubDate });
              updates.recentNews = matchingCb.recentNews.slice(0, 5);
          }

          if (Object.keys(updates).length > 0) {
              logger.info(`📝 Enriching existing NEW comeback for ${candidateName}: ${JSON.stringify(updates)}`);
              await updateDoc(doc(db, "comebacks", matchingCb.id), updates);
              Object.assign(matchingCb, updates);
          }
          continue;
        }

        if (existingComebackKeys.has(comebackKey)) {
          continue;
        }

        const bugsInfo = await fetchBugsArtistValidation(candidateName);
        if (bugsInfo) {
          logger.info(`✅ Verified NEW artist ${candidateName} on Bugs!`);
          
          let enrichedDate = releaseDate;
          let enrichedType = releaseType;
          let enrichedTitle = "";
          
          if (releaseDate === "TBA" || releaseDate.includes("TBA")) {
            const ytInfo = await fetchYouTubeCommunityInfo(candidateName);
            if (ytInfo) {
              if (ytInfo.releaseDate) enrichedDate = ytInfo.releaseDate;
              if (ytInfo.releaseType) enrichedType = ytInfo.releaseType;
              if (ytInfo.title) enrichedTitle = ytInfo.title;
              if (ytInfo.albumCoverUrl && !albumCoverUrl) albumCoverUrl = ytInfo.albumCoverUrl;
              logger.info(`📺 YouTube enriched NEW ${candidateName}: date=${enrichedDate}`);
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          // Use the more specific artistType from Naver News if available (e.g. 'unit', 'solo')
          // Otherwise, fallback to the one from Bugs ('group' or 'solo')
          const finalArtistType = artistTypeFromArticle && artistTypeFromArticle !== 'band' 
                                  ? artistTypeFromArticle 
                                  : bugsInfo.type;

          const artistRef = await addDoc(collection(db, "artists"), {
            name: { ko: candidateName, en: candidateName },
            type: finalArtistType || "group",
            gender: bugsInfo.gender || "mixed",
            createdAt: new Date().toISOString()
          });

          const docData: any = {
            artistName: candidateName,
            artistId: artistRef.id,
            title: enrichedTitle || "TBA",
            releaseDate: enrichedDate,
            releaseType: enrichedType,
            agencyName: "Unknown",
            isReleased: false,
            sourceTitle: title,
            sourceLink: item.link,
            createdAt: new Date().toISOString(),
            recentNews: [{ title: item.title, link: item.link, pubDate: item.pubDate }]
          };

          if (albumCoverUrl) docData.albumCoverUrl = albumCoverUrl;
          if (scrapedData.summary) docData.aiSummary = scrapedData.summary;

          // Double check after enrichment
          const postEnrichMatch = findMatchingComeback(candidateName, enrichedDate);
          if (postEnrichMatch || existingComebackKeys.has(`${candidateName}_${enrichedDate}`)) {
             if (postEnrichMatch) {
                // Enrich it instead
                const updates: any = {};
                if (!postEnrichMatch.recentNews) postEnrichMatch.recentNews = [];
                if (!postEnrichMatch.recentNews.some((n: any) => n.link === item.link)) {
                    postEnrichMatch.recentNews.unshift({ title: item.title, link: item.link, pubDate: item.pubDate });
                    updates.recentNews = postEnrichMatch.recentNews.slice(0, 5);
                }
                if (scrapedData.summary && !postEnrichMatch.aiSummary) {
                    updates.aiSummary = scrapedData.summary;
                }
                if (Object.keys(updates).length > 0) {
                    await updateDoc(doc(db, "comebacks", postEnrichMatch.id), updates);
                }
             }
             addComebackDate(candidateName, releaseDate, docData, postEnrichMatch?.id || "");
             break;
          }

          const newDocRef = await addDoc(collection(db, "comebacks"), docData);
          newReviewsCount++;
          addComebackDate(candidateName, releaseDate, docData, newDocRef.id);
          addComebackDate(candidateName, enrichedDate, docData, newDocRef.id);
          break; 
        } else {
          logger.info(`❌ Rejected ${candidateName}: Not found on Bugs.`);
        }
        
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (newReviewsCount > 0) {
    logger.info(`Found and added ${newReviewsCount} new comebacks directly to DB.`);
  } else {
    logger.info("No new comebacks found to add.");
  }

  logger.info("Weekly Discovery complete.");
  process.exit(0);
}

runWeeklyCrawler().catch(e => {
  logger.error("Weekly Crawler Critical Failure:", e);
  process.exit(1);
});
