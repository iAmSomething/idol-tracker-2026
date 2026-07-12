import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import axios from 'axios';
import * as cheerio from 'cheerio';

async function sendTelegramReviewMessage(docId: string, data: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. Skipping Telegram notification.');
    return;
  }
  
  const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  
  const text = `🔔 <b>신규 컴백/데뷔 검토 필요</b>\n\n` +
    `아티스트: <b>${escapeHtml(data.artistName)}</b>\n` +
    `유형: ${data.type === 'new_artist' ? '신규 발굴 🆕' : '기존 컴백 🔄'}\n` +
    `발매일: ${data.releaseDate}\n` +
    `형태: ${data.releaseType}\n` +
    (data.type === 'new_artist' ? `성별: ${data.artistGender} | 그룹/솔로: ${data.artistType}\n` : '') +
    `출처: <a href="${data.sourceLink}">${escapeHtml(data.sourceTitle)}</a>\n\n` +
    `아래 버튼을 눌러 처리해주세요.`;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ 통과", callback_data: `APPROVE_${docId}` },
            { text: "✏️ 수정", callback_data: `EDIT_${docId}` },
            { text: "❌ 거부", callback_data: `REJECT_${docId}` }
          ]
        ]
      }
    });
  } catch (e: any) {
    logger.error('Failed to send Telegram message:', e.message);
  }
}

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const parser = new Parser();

const stopWords = new Set(["신인", "보이그룹", "걸그룹", "아이돌", "밴드", "가수", "오늘", "내일", "정식", "드디어", "컴백", "데뷔", "신곡", "발매", "발표", "확정", "첫", "미니", "정규", "앨범", "티저", "공개", "음원", "뮤비", "쇼케이스", "출격", "기대", "주목", "화제", "제작", "소속사", "대표", "프로듀서", "합류", "멤버", "공식", "단독", "현장", "종합", "리포트", "인터뷰", "포토", "영상", "왔다", "품고", "돌아온다", "출신", "전격", "뉴스핌", "v", "daum", "net", "com", "co", "kr", "스포츠동아", "스타뉴스", "엑스포츠뉴스", "OSEN", "오센", "뉴스엔", "마이데일리", "스타투데이", "뉴스1", "뉴시스", "디스패치", "TV리포트"]);

function extractCandidates(title: string): string[] {
  let text = title.replace(/\[.*?\]|\(.*?\)/g, " ");
  text = text.replace(/['"‘”“’`~!?@#$%^&*_+={}\[\]:;|<>\.\,\/\\…\-]/g, " ");
  
  const words = text.split(/\s+/).filter(w => w.length > 1);
  const candidates: string[] = [];
  const particles = ["으로", "만의", "에서", "부터", "까지", "은", "는", "이", "가", "로", "의", "와", "과", "도", "을", "를", "만"];

  for (let word of words) {
    let cleanWord = word;
    for (const p of particles) {
      if (cleanWord.endsWith(p) && cleanWord.length > p.length) {
        cleanWord = cleanWord.slice(0, -p.length);
        break; 
      }
    }
    
    if (cleanWord.length > 1 && !stopWords.has(cleanWord)) {
      candidates.push(cleanWord);
    }
  }
  return candidates;
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

  for (const item of allNews) {
    const title = item.title || "";
    const candidates = extractCandidates(title);
    
    for (const candidateName of candidates) {
      if (candidateName.length < 2 || seenCandidates.has(candidateName)) {
        continue;
      }
      seenCandidates.add(candidateName);

      const releaseDate = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const comebackKey = `${candidateName}_${releaseDate}`;

      if (existingComebackKeys.has(comebackKey) || pendingKeys.has(comebackKey)) {
        continue; // Already tracked or already pending
      }

      const releaseType = title.includes("정규") ? "full" : (title.includes("미니") ? "mini" : "single");
      let artistId = existingArtistsMap.get(candidateName);

      if (!artistId) {
        // New artist, verify with Bugs Music
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
          const docRef = await addDoc(collection(db, "pending_reviews"), docData);
          await sendTelegramReviewMessage(docRef.id, docData);
          newReviewsCount++;
          pendingKeys.add(comebackKey);
        } else {
          logger.info(`❌ Rejected ${candidateName}: Not found as an active idol/singer on Bugs.`);
          continue;
        }
      } else {
        logger.info(`🔄 Existing artist ${candidateName} is having a comeback! (from: ${title})`);
        
        const docData = {
          type: 'existing_artist',
          artistName: candidateName,
          artistId: artistId,
          releaseDate: releaseDate,
          releaseType: releaseType,
          sourceTitle: title,
          sourceLink: item.link || "",
          createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, "pending_reviews"), docData);
        await sendTelegramReviewMessage(docRef.id, docData);
        newReviewsCount++;
        pendingKeys.add(comebackKey);
      }
      
      await new Promise(r => setTimeout(r, 1000));
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
