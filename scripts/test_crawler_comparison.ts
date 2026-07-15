import * as path from "path";
import * as dotenv from "dotenv";
import Parser from "rss-parser";
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const parser = new Parser();
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Utility to clean text
function cleanText(text: string) {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Simple extractor for Artist, Date, Type
function extractInfo(text: string) {
  // Extract proper noun as Artist (naive approach for test)
  let artistMatch = text.match(/^\[.*?\]\s*([가-힣A-Za-z0-9]+)(은|는|이|가|,|의|에)?/);
  let artist = artistMatch ? artistMatch[1] : "TBA";
  if (artist === "TBA") {
    let fallback = text.match(/([가-힣A-Za-z0-9]+)(은|는|이|가|,|의|에)?\s+(컴백|데뷔|신곡|앨범)/);
    if (fallback) artist = fallback[1];
  }

  const exactDateMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  let date = "TBA";
  if (exactDateMatch) {
    date = `${exactDateMatch[1]}월 ${exactDateMatch[2]}일`;
  } else {
    const monthMatch = text.match(/(\d{1,2})월/);
    if (monthMatch) date = `${monthMatch[1]}월 TBA`;
  }

  let type = "unknown";
  if (text.includes("정규")) type = "full";
  else if (text.includes("미니")) type = "mini";
  else if (text.includes("싱글")) type = "single";

  const quoteMatch = text.match(/['"‘“]([^'"’”]+)['"’”]/);
  let album = quoteMatch ? quoteMatch[1] : "TBA";

  return { artist, date, type, album };
}

// 1. Google News
async function getGoogleComebacks(targetCount: number) {
  const queryStr = `"컴백" OR "데뷔" OR "신곡" (아이돌 OR 걸그룹 OR 보이그룹 OR 밴드 OR 가수)`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await parser.parseURL(url);
  
  const results = [];
  for (const item of feed.items) {
    if (results.length >= targetCount) break;
    
    if (!item.isoDate) continue;
    const pubDate = new Date(item.isoDate).getTime();
    if (NOW - pubDate > TWO_WEEKS_MS) continue; // within 2 weeks

    const info = extractInfo(item.title || "");
    // Require at least a date or album to count as secured
    if (info.artist !== "TBA" && (info.date !== "TBA" || info.album !== "TBA")) {
      results.push({
        title: item.title,
        link: item.link,
        pubDate: item.isoDate,
        info
      });
    }
  }
  return results;
}

// 2. Naver News (Using sort=date to get recent)
async function scrapeNaverContent(url: string) {
  try {
    const res = await axios.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    let content = $('#dic_area').text();
    if (!content) content = $('article').text();
    return cleanText(content);
  } catch (e) {
    return "";
  }
}

async function getNaverComebacks(targetCount: number) {
  const queryStr = `아이돌 컴백`;
  let results = [];
  let start = 1;
  
  while (results.length < targetCount && start <= 100) {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(queryStr)}&display=20&start=${start}&sort=date`;
    try {
      const res = await axios.get(url, {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }
      });
      
      const items = res.data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (results.length >= targetCount) break;
        
        const pubDate = new Date(item.pubDate).getTime();
        if (NOW - pubDate > TWO_WEEKS_MS) continue;

        const title = cleanText(item.title);
        const link = item.link;

        // We only want naver news for scraping
        if (!link.includes('n.news.naver.com') && !link.includes('entertain.naver.com')) continue;

        let info = extractInfo(title);
        const content = await scrapeNaverContent(link);
        if (content) {
          const contentInfo = extractInfo(content);
          // Enrich with content if title missed it
          if (info.date === "TBA" && contentInfo.date !== "TBA") info.date = contentInfo.date;
          if (info.album === "TBA" && contentInfo.album !== "TBA") info.album = contentInfo.album;
          if (info.type === "unknown" && contentInfo.type !== "unknown") info.type = contentInfo.type;
        }

        if (info.artist !== "TBA" && (info.date !== "TBA" || info.album !== "TBA")) {
          results.push({ title, link, pubDate: item.pubDate, info, contentAvailable: !!content });
        }
      }
      start += 20;
    } catch (e) {
      console.error("Naver error", e);
      break;
    }
  }
  return results;
}

// 3. Daum News
async function scrapeDaumContent(url: string) {
  try {
    const res = await axios.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    return cleanText($('.article_view').text());
  } catch (e) {
    return "";
  }
}

async function getDaumComebacks(targetCount: number) {
  // query & sort=recency
  const queryStr = `아이돌 컴백`;
  let results = [];
  let page = 1;

  while (results.length < targetCount && page <= 5) {
    const url = `https://search.daum.net/search?w=news&sort=recency&p=${page}&q=${encodeURIComponent(queryStr)}`;
    try {
      const res = await axios.get(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $ = cheerio.load(res.data);
      
      const items = $('a').toArray();
      for (const el of items) {
        if (results.length >= targetCount) break;
        const link = $(el).attr('href') || "";
        const title = $(el).text().trim();
        
        // Match Daum news link and ensure it's not a short garbage link
        if (link.includes('v.daum.net/v/') && title.length > 10) {
          // Avoid duplicates
          if (results.find(x => x.link === link)) continue;

          let info = extractInfo(title);
          const content = await scrapeDaumContent(link);
          if (content) {
            const contentInfo = extractInfo(content);
            if (info.date === "TBA" && contentInfo.date !== "TBA") info.date = contentInfo.date;
            if (info.album === "TBA" && contentInfo.album !== "TBA") info.album = contentInfo.album;
            if (info.type === "unknown" && contentInfo.type !== "unknown") info.type = contentInfo.type;
          }

          if (info.artist !== "TBA" && (info.date !== "TBA" || info.album !== "TBA")) {
            // Check date heuristically if possible (Daum doesn't easily expose pubDate in the a-tag list, assume recency sort keeps it within 2 weeks for page 1-5)
            results.push({ title, link, info, contentAvailable: !!content });
          }
        }
      }
      page++;
    } catch (e) {
      console.error("Daum error", e);
      break;
    }
  }
  return results;
}

async function run() {
  console.log("=========================================");
  console.log("       1. GOOGLE NEWS RSS TEST           ");
  console.log("=========================================\n");
  const google = await getGoogleComebacks(5);
  google.forEach((g, i) => {
    console.log(`[${i+1}] ${g.title}`);
    console.log(`    Artist: ${g.info.artist} | Date: ${g.info.date} | Type: ${g.info.type} | Album: ${g.info.album}\n`);
  });

  console.log("=========================================");
  console.log("       2. NAVER NEWS API TEST            ");
  console.log("=========================================\n");
  const naver = await getNaverComebacks(5);
  naver.forEach((n, i) => {
    console.log(`[${i+1}] ${n.title}`);
    console.log(`    Artist: ${n.info.artist} | Date: ${n.info.date} | Type: ${n.info.type} | Album: ${n.info.album} | Scraped: ${n.contentAvailable}\n`);
  });

  console.log("=========================================");
  console.log("       3. DAUM NEWS SEARCH TEST          ");
  console.log("=========================================\n");
  const daum = await getDaumComebacks(5);
  daum.forEach((d, i) => {
    console.log(`[${i+1}] ${d.title}`);
    console.log(`    Artist: ${d.info.artist} | Date: ${d.info.date} | Type: ${d.info.type} | Album: ${d.info.album} | Scraped: ${d.contentAvailable}\n`);
  });
}

run().catch(console.error);
