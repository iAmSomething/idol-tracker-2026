import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import { parseNaverArticleRegex } from "../scripts/lib/naver_news_scraper"; // Using the regex part

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "x_zYJ0B_9rL57bW82EIt";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Bw1oXf0l0L";

interface ExtractedInfo {
  date: string | null;
  type: string | null;
  artistType: string | null;
}

// Ollama API request
async function askQwen(articleText: string, title: string): Promise<ExtractedInfo | null> {
  const prompt = `다음은 K-Pop 아이돌 컴백/데뷔에 관한 뉴스 기사입니다. 기사를 읽고 다음 정보만 추출해서 JSON 형태로 반환하세요:
- date: YYYY-MM-DD 형식의 발매일 (없으면 null)
- type: 'full'(정규), 'mini'(미니/EP), 'single'(싱글) 중 하나 (없으면 null)
- artistType: 'group'(그룹), 'solo'(솔로), 'unit'(유닛) 중 하나 (없으면 null)

절대 다른 설명 없이 순수한 JSON 문자열만 응답하세요.

기사 제목: ${title}
기사 본문:
${articleText.substring(0, 3000)} // truncate to avoid too large context
`;

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen3:latest",
      prompt: prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.0
      }
    });

    const jsonStr = response.data.response;
    const parsed = JSON.parse(jsonStr);
    return {
      date: parsed.date || null,
      type: parsed.type || null,
      artistType: parsed.artistType || null
    };
  } catch (error) {
    console.error("Qwen API Error:", error);
    return null;
  }
}

async function fetchArticleBody(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 5000
    });
    const $ = cheerio.load(res.data);
    const bodyText = $("#dic_area").text().trim() || $("article").text().trim() || $("body").text().trim();
    return bodyText;
  } catch (e) {
    return "";
  }
}

async function runComparison() {
  console.log("🔍 Fetching recent 5 articles from Naver News...");
  const searchUrl = "https://openapi.naver.com/v1/search/news.json";
  const queryStr = '"컴백" OR "데뷔"';

  const res = await axios.get(searchUrl, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
    params: {
      query: queryStr,
      display: 5,
      sort: "date",
    },
  });

  const items = res.data.items;

  let regexTotalTime = 0;
  let qwenTotalTime = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rawTitle = item.title.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"');
    const rawDesc = item.description.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"');
    const link = item.link;

    console.log(`\n===========================================`);
    console.log(`📰 [기사 ${i+1}] ${rawTitle}`);
    
    let html = "";
    let bodyText = rawDesc;
    if (link.includes("n.news.naver.com")) {
      try {
        const hRes = await axios.get(link, { headers: { "User-Agent": "Mozilla/5.0" }});
        html = hRes.data;
        const $ = cheerio.load(html);
        bodyText = $("#dic_area").text().trim() || rawDesc;
      } catch (e) {}
    }

    // 1. Regex approach
    const startRegex = performance.now();
    
    // Copying the regex logic from naver_news_scraper.ts
    const combinedText = rawTitle + " " + rawDesc + " " + bodyText;
    let rDate: string | null = null;
    let rType: string | null = null;
    let rArtistType: string | null = null;

    // Type
    if (/미니|EP/i.test(combinedText)) rType = "mini";
    else if (/정규/i.test(combinedText)) rType = "full";
    else if (/싱글/i.test(combinedText)) rType = "single";

    // Artist Type
    if (/솔로/.test(combinedText)) rArtistType = "solo";
    else if (/유닛/.test(combinedText)) rArtistType = "unit";
    else if (/그룹/.test(combinedText)) rArtistType = "group";

    // Date
    const dateMatch = combinedText.match(/(?:202[4-9]년\s*)?([1-9]|1[0-2])월\s*([1-9]|[12][0-9]|3[01])일/);
    if (dateMatch) {
      const year = new Date().getFullYear();
      const month = dateMatch[1].padStart(2, "0");
      const day = dateMatch[2].padStart(2, "0");
      rDate = `${year}-${month}-${day}`;
    }

    const regexResult = { date: rDate, releaseType: rType, artistType: rArtistType };

    const endRegex = performance.now();
    const regexTime = endRegex - startRegex;
    regexTotalTime += regexTime;

    // 2. Qwen approach
    const startQwen = performance.now();
    const qwenResult = await askQwen(bodyText, rawTitle);
    const endQwen = performance.now();
    const qwenTime = endQwen - startQwen;
    qwenTotalTime += qwenTime;

    console.log(`\n[Regex] (소요시간: ${regexTime.toFixed(2)}ms)`);
    console.log(` - Date: ${regexResult.date}`);
    console.log(` - Release Type: ${regexResult.releaseType}`);
    console.log(` - Artist Type: ${regexResult.artistType}`);

    console.log(`\n[Qwen]  (소요시간: ${qwenTime.toFixed(2)}ms)`);
    console.log(` - Date: ${qwenResult?.date}`);
    console.log(` - Release Type: ${qwenResult?.type}`);
    console.log(` - Artist Type: ${qwenResult?.artistType}`);
  }

  console.log(`\n===========================================`);
  console.log(`⏱️ 평균 소요 시간 비교`);
  console.log(` - 정규식 (Regex): ${(regexTotalTime / items.length).toFixed(2)} ms / 기사`);
  console.log(` - Qwen3 (LLM)   : ${(qwenTotalTime / items.length).toFixed(2)} ms / 기사`);
}

runComparison();
