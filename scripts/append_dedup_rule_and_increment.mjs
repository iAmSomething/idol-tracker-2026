import fs from "fs";

let content = fs.readFileSync("AGENTS.md", "utf-8");

// 1. Add the new deduplication rule
const ruleText = `
### 4) 데이터 파편화 방지 및 Alias 매핑 로직 (동일 아티스트 분할 생성 금지)
- **발생한 문제:** "idntt"와 "아이덴티티", "디렉션(D:D)"과 "DAILY:DIRECTION", "8TURN(에잇턴)"과 "8TURN", "레드벨벳"과 "RedVelvet", "뉴진스"와 "NewJeans" 등 동일 그룹이 기사마다 영문/한글 혼용 표기나 괄호 표기(\`8TURN(에잇턴)\`)로 인해 서로 다른 아티스트 ID로 중복 생성되는 파편화 문제가 끝없이 발생했습니다. 특히 이로 인해 Bugs API에서 Alias를 인식하지 못하고 검색에 실패하여 "Not Found"를 뱉어버리는 버그가 속출했습니다.
- **해결책 (Alias 크로스체크 의무화):** 새로운 아티스트 문서를 \`artists\` 컬렉션에 무턱대고 \`setDoc\` 또는 \`addDoc\` 하기 전, 크롤러에서 추출된 아티스트 이름이 기존 \`artists\` 컬렉션 내의 모든 문서들의 \`name.en\`, \`name.ko\`, 또는 \`aliases\` 배열에 포함되어 있는지 **철저히 루프를 돌며 검증**해야 합니다.
  - 모든 문자열은 공백 제거(replaceAll(' ', '')) 및 소문자 변환(toLowerCase()) 후 비교해야 합니다.
  - 매칭되는 기존 문서나 Alias가 단 하나라도 존재한다면 절대 새로운 아티스트로 등록하지 말고, **반드시 기존 \`artists\` 문서의 \`artistId\`와 정규 \`artistName\`을 그대로 상속받아 병합(Merge/Reuse) 처리** 해야 합니다.

**[동시간대 리믹스/버전 앨범 중복 방지 (Deduplication)]**
- **발생한 문제:** 앨범 크롤링 중 같은 아티스트가 동일한 날짜(또는 매우 인접한 날짜)에 'Earl Grey Ver.', 'Cotton Candy Ver.', 'Remix' 등의 파생 앨범을 여러 개 발매할 경우, DB에 똑같은 아티스트의 컴백 일정이 4~5개씩 무더기로 생성되어 캘린더를 도배하는 심각한 중복 문제가 발생했습니다. (예: 연준 13일 컴백, Aespa 14일 컴백)
- **해결책:** 크롤러 삽입 스크립트(\`seed_bugs_comebacks\`) 실행 시, 반드시 **\`artistId\`와 \`releaseDate\`의 조합을 식별 키**로 사용하여 중복을 제거(Deduplication)해야 합니다. 여러 앨범이 발견되면 제목에 "Ver", "Remix", "Instrumental", "Inst", "Mix" 등의 키워드가 들어간 파생 앨범은 폐기하고 **단 하나의 대표 앨범(가장 트랙 수가 많거나 리믹스가 아닌 앨범)만 DB에 Insert** 하도록 필터링해야 합니다.
`;

// Replace the original section 4 with the updated one
const targetHeader = `### 4) 데이터 파편화 방지 및 Alias 매핑 로직 (동일 아티스트 분할 생성 금지)`;
const endOfSection4 = `  - 매칭되는 기존 문서나 Alias가 단 하나라도 존재한다면 절대 새로운 아티스트로 등록하지 말고, **반드시 기존 \`artists\` 문서의 \`artistId\`와 정규 \`artistName\`을 그대로 상속받아 병합(Merge/Reuse) 처리** 해야 합니다.`;

if (content.includes(targetHeader) && !content.includes("[동시간대 리믹스/버전 앨범 중복 방지")) {
  const sectionStart = content.indexOf(targetHeader);
  const sectionEnd = content.indexOf(endOfSection4) + endOfSection4.length;
  content = content.slice(0, sectionStart) + ruleText + content.slice(sectionEnd);
}

// 2. Increment the Agent Read Count
content = content.replace(/### Agent Read Count\n(\d+)/, (match, p1) => {
  const count = parseInt(p1, 10) + 1;
  return `### Agent Read Count\n${count}`;
});

fs.writeFileSync("AGENTS.md", content, "utf-8");
console.log("Appended deduplication rule and incremented Agent Read Count.");
