import fs from "fs";

let content = fs.readFileSync("AGENTS.md", "utf-8");

// 1. Add the new crawling rule
const ruleText = `
**[정적 날짜 하드코딩 절대 금지 (Dynamic Date Window)]**
최근 파이썬 크롤러(Kaggle Crawler) 스크립트에서 \`end_date\`를 "2026-07-10"과 같이 특정 날짜로 **하드코딩(Hardcoding)** 해놓은 바람에, 7월 11일 이후의 모든 발매 데이터(13일 컴백 포함)를 크롤러가 통째로 스킵해버리는 치명적인 전수 크롤링 버그가 발생했습니다.
- **해결책:** 크롤러 스크립트 작성 시, 수집 범위를 지정할 때는 **절대 특정 연월일을 하드코딩하지 마십시오.** 항상 시스템의 현재 시간(Now)을 기준으로, ` + "`" + `start_date = today - 7 days` + "`" + ` 와 같이 상대적인(Dynamic) 날짜 윈도우를 계산하여 적용해야 합니다. 그래야 미래에 스크립트가 실행될 때도 누락 없이 최근 데이터를 수집할 수 있습니다.
`;

// Insert the rule right after the code block of section 1)
const targetBlock = `continue;
}`;
if (content.includes(targetBlock) && !content.includes("[정적 날짜 하드코딩 절대 금지")) {
  content = content.replace(targetBlock, targetBlock + "\n" + ruleText);
}

// 2. Increment the Agent Read Count
content = content.replace(/### Agent Read Count\n(\d+)/, (match, p1) => {
  const count = parseInt(p1, 10) + 1;
  return `### Agent Read Count\n${count}`;
});

fs.writeFileSync("AGENTS.md", content, "utf-8");
console.log("Appended new crawler rule and incremented Agent Read Count.");
