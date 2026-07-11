const titles = [
  "루네이트, 22일 미니 4집 ‘Off the Grid’ 발매 확정..청량美 품고 컴백",
  "루네이트, 미니 4집 'Off the Grid'로 22일 컴백 확정",
  "유노윤호, 이별의 순간 노래한다…20일 컴백 확정",
  "NCT 127, 내달 25일 정규 7집으로 컴백",
  "프로미스나인, 정규 2집 컴백",
  "프로미스나인, 21일 컴백 확정… 정규 2집 '글로우 미' 발매",
  "블랙핑크, 8월 1일 정규앨범 'BORN PINK' 컴백",
  "있지(ITZY), 15일 새 앨범 ‘GOLD’ 발매 확정"
];

function extractComeback(title) {
  let cleanTitle = title.replace(/^\[.*?\]\s*/, '').replace(/^'.*?'\s*/, '').trim();
  const match = cleanTitle.match(/^([가-힣a-zA-Z0-9\-\(\)]+)(?:,| |가 |은 |는 )/);
  if (!match) return null;
  const artist = match[1];

  let month = null;
  let day = null;
  const dateMatch = cleanTitle.match(/(?:([1-9]|1[0-2])월\s*)?([1-9]|[1-2][0-9]|3[0-1])일/);
  if (dateMatch) {
    month = dateMatch[1] ? parseInt(dateMatch[1]) : null;
    day = parseInt(dateMatch[2]);
  }
  
  // Extract Type
  let type = 'unknown';
  if (/미니\s*\d*집?|EP/.test(cleanTitle)) type = 'mini';
  else if (/정규\s*\d*집?/.test(cleanTitle)) type = 'regular';
  else if (/싱글/.test(cleanTitle)) type = 'single';

  // Extract Album Title (Text inside quotes)
  let albumTitle = 'TBA';
  const quoteMatch = cleanTitle.match(/['‘"“]([^'’"”]+)['’”"]/);
  if (quoteMatch) {
    albumTitle = quoteMatch[1];
  }

  return { artist, month, day, type, albumTitle };
}

for (const t of titles) {
  console.log(extractComeback(t));
}
