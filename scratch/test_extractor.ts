import * as cheerio from 'cheerio';

const titles = [
  "[단독] 투모로우바이투게더, 4월 컴백 확정",
  "'괴물 신인' 아이릿, 데뷔곡 차트 1위",
  "NCT DREAM, 정규 3집 'ISTJ' 선주문 410만 장 돌파",
  "뉴진스가 돌아온다",
  "르세라핌 컴백 카운트다운",
  "세븐틴, 역대급 앨범으로 출격",
  "BABYMONSTER 정식 데뷔"
];

const stopWords = new Set(["단독", "신인", "보이그룹", "걸그룹", "아이돌", "컴백", "데뷔", "신곡", "발매", "발표", "확정", "정규", "미니", "앨범", "티저", "공개", "음원", "뮤비", "출격", "기대", "주목", "제작", "소속사", "합류", "멤버", "공식", "현장", "종합", "리포트", "인터뷰", "포토", "영상", "전격", "돌아온다"]);

function extractLikelyProperNouns(title: string): string[] {
  const candidates = new Set<string>();

  // 1. Words enclosed in quotes (single or double)
  const quoteRegex = /['"‘“](.*?)['"’”]/g;
  let match;
  while ((match = quoteRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 2. Capitalized English words (2 or more letters)
  const engRegex = /\b[A-Z][A-Za-z0-9-]+\b/g;
  while ((match = engRegex.exec(title)) !== null) {
    const word = match[0].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 3. Words before comma (often subjects in news titles like "세븐틴, ...")
  const commaRegex = /([가-힣A-Za-z0-9]+)\s*,/g;
  while ((match = commaRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 4. Words ending with subject particles (은, 는, 이, 가, 가) 
  // e.g., "뉴진스가", "아이브는"
  const particleRegex = /([가-힣A-Za-z0-9]+)(은|는|이|가)\s+/g;
  while ((match = particleRegex.exec(title)) !== null) {
    const word = match[1].trim();
    if (word.length > 1 && !stopWords.has(word)) candidates.add(word);
  }

  // 5. Fallback: just look at the very first word in the title after stripping brackets.
  let cleanTitle = title.replace(/\[.*?\]/g, "").trim();
  const firstWord = cleanTitle.split(/\s+/)[0].replace(/['"‘”“’`~!?@#$%^&*_+={}\[\]:;|<>\.\,\/\\…\-]/g, "");
  if (firstWord.length > 1 && !stopWords.has(firstWord)) {
    // Strip trailing particles if any
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

for (const title of titles) {
  console.log(`Title: ${title}`);
  console.log(`Candidates:`, extractLikelyProperNouns(title));
  console.log('---');
}
