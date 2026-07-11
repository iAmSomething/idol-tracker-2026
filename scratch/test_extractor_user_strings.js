const titles = [
  "빅뱅 8월 중 신곡 발표 계획",
  "스트레이키즈 8월 7일 새 미니앨범 '디스 앤드 댓(THIS & THAT)'으로 컴백",
  "선미 7월 15일 오후6시 싱글\"Forever July\"",
  "8TURN(에잇턴) 7월 21일 오후6시 싱글 [8.X] 컴백",
  "프로미스나인(fromis_9) 21일 정규2집 'Glow ME'",
  "효린 7월 22일 미니 4집 22일 오후 6시 'OriginaLyn(오리지널린)'",
  "NCT127 8월 25일 정규7집 컴백"
];

function extractComeback(title) {
  let cleanTitle = title.replace(/^\[.*?\]\s*/, '').replace(/^'.*?'\s*/, '').trim();
  const match = cleanTitle.match(/^([가-힣a-zA-Z0-9\-\(\)_]+)(?:,| |가 |은 |는 )/);
  if (!match) return { raw: title, error: 'No artist match' };
  
  let artist = match[1];

  let month = null;
  let day = null;
  const dateMatch = cleanTitle.match(/(?:([1-9]|1[0-2])월\s*)?([1-9]|[1-2][0-9]|3[0-1])일/);
  if (dateMatch) {
    month = dateMatch[1] ? parseInt(dateMatch[1]) : null;
    day = parseInt(dateMatch[2]);
  }
  
  if (!day && !cleanTitle.includes('8월 중')) return { raw: title, error: 'No day match' };

  let type = 'unknown';
  if (/미니\s*\d*집?|EP/.test(cleanTitle)) type = 'mini';
  else if (/정규\s*\d*집?/.test(cleanTitle)) type = 'regular';
  else if (/싱글/.test(cleanTitle)) type = 'single';

  let albumTitle = 'TBA';
  const quoteMatch = cleanTitle.match(/['‘"“\[]([^'’"”\]]+)['’”"\]]/);
  if (quoteMatch) {
    albumTitle = quoteMatch[1];
  }
  
  return { artist, month, day, type, albumTitle, raw: title };
}

for (const t of titles) {
  console.log(extractComeback(t));
}
