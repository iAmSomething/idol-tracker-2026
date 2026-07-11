const titles = [
  "루네이트, 22일 미니 4집 ‘Off the Grid’ 발매 확정..청량美 품고 컴백",
  "루네이트, 미니 4집 'Off the Grid'로 22일 컴백 확정",
  "유노윤호, 이별의 순간 노래한다…20일 컴백 확정",
  "“할렐루야, 맥이 돌아왔다” 맥그리거, 5년만의 컴백",
  "'렛미플라이', 3년 만에 컴백…오의식·김지현 귀환→안재욱·이희준 합...",
  "하지원, 6년 만에 스크린 컴백…'비광', 9월 2일 개봉 확정",
  "이민혁, 7월 15일 컴백 확정…거침 없는 질주 에너지",
  "[핌 포커스] 빅뱅·NCT 127·스키즈 컴백…K팝 황금기 구원투수 될까",
  "지예은·지석진, 프로젝트 듀오 ‘충주지씨’로 1년 만에 컴백",
  "NCT 127, 내달 25일 정규 7집으로 컴백",
  "'29일 컴백' 더윈드, 컴백 카운트다운",
  "프로미스나인, 정규 2집 컴백",
  "프로미스나인, 21일 컴백 확정… 정규 2집 '글로우 미' 발매"
];

function extractComeback(title) {
  // Clean up bracketed prefixes like [단독], [포커스], '29일 컴백'
  let cleanTitle = title.replace(/^\[.*?\]\s*/, '').replace(/^'.*?'\s*/, '').trim();

  // Try to find the artist name at the beginning, followed by a comma or space
  const match = cleanTitle.match(/^([가-힣a-zA-Z0-9\-]+)(?:,| |가 |은 |는 )/);
  if (!match) return null;
  const artist = match[1];

  // Try to find the date (M월 D일 or just D일 or 내달 D일)
  let month = null;
  let day = null;
  
  const dateMatch = cleanTitle.match(/(?:([1-9]|1[0-2])월\s*)?([1-9]|[1-2][0-9]|3[0-1])일/);
  if (dateMatch) {
    month = dateMatch[1] ? parseInt(dateMatch[1]) : null;
    day = parseInt(dateMatch[2]);
  }
  
  return { artist, month, day, original: title };
}

for (const t of titles) {
  console.log(extractComeback(t));
}
