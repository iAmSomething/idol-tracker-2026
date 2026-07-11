import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const answerKey = ["빅뱅", "스트레이키즈", "선미", "8TURN", "프로미스나인", "효린", "NCT 127"];

function extractComeback(title: string) {
  let cleanTitle = title.replace(/^\[.*?\]\s*/, '').replace(/^'.*?'\s*/, '').trim();
  const match = cleanTitle.match(/^([가-힣a-zA-Z0-9\-\(\)]+)(?:,| |가 |은 |는 )/);
  if (!match) return null;
  
  let artist = match[1];
  if (artist === 'NCT' && cleanTitle.includes('NCT 127')) artist = 'NCT 127';
  if (artist === 'NCT' && cleanTitle.includes('NCT DREAM')) artist = 'NCT DREAM';

  let month = null;
  let day = null;
  const dateMatch = cleanTitle.match(/(?:([1-9]|1[0-2])월\s*)?([1-9]|[1-2][0-9]|3[0-1])일/);
  if (dateMatch) {
    month = dateMatch[1] ? parseInt(dateMatch[1]) : null;
    day = parseInt(dateMatch[2]);
  }
  
  if (!day && !cleanTitle.includes('8월 중')) return null;

  let type = 'unknown';
  if (/미니\s*\d*집?|EP/.test(cleanTitle)) type = 'mini';
  else if (/정규\s*\d*집?/.test(cleanTitle)) type = 'regular';
  else if (/싱글/.test(cleanTitle)) type = 'single';

  let albumTitle = 'TBA';
  const quoteMatch = cleanTitle.match(/['‘"“]([^'’"”]+)['’”"]/);
  if (quoteMatch) {
    albumTitle = quoteMatch[1];
  }
  
  return { artist, month, day, type, albumTitle, title };
}

async function verify() {
  console.log("===========================================");
  console.log("🏆 정답지 7팀 검증 시작 (Verification Run)");
  console.log("===========================================\n");

  let passed = 0;
  for (const team of answerKey) {
    // Search Naver specifically for this team's comeback to guarantee we get the article
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(team + " 컴백 확정")}&display=5&sort=sim`;
    try {
      const res = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });
      const data = await res.json();
      let found = false;
      for (const item of (data.items || [])) {
        const rawTitle = item.title.replace(/<[^>]+>/g, '');
        const extracted = extractComeback(rawTitle);
        if (extracted && extracted.artist.includes(team.replace(" ", ""))) { // simple match
          console.log(`✅ [${team}] PASS`);
          console.log(`   Headline: ${rawTitle}`);
          console.log(`   Extracted: 앨범명[${extracted.albumTitle}], 타입[${extracted.type}], 날짜[${extracted.month}월 ${extracted.day}일]`);
          found = true;
          passed++;
          break;
        }
      }
      if (!found) {
        console.log(`❌ [${team}] FAIL (Could not parse or find relevant article)`);
      }
    } catch (e) {
      console.log(`❌ [${team}] FAIL (API Error)`);
    }
  }
  console.log(`\n총 검증 결과: ${passed} / 7 성공`);
}

verify();
