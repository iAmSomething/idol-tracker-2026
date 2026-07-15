import fs from "fs";

let content = fs.readFileSync("AGENTS.md", "utf-8");

// Increment the counter because we are reading it now
let newContent = content.replace(/### Agent Read Count\n(\d+)/, (match, p1) => {
  const count = parseInt(p1, 10) + 1;
  return `### Agent Read Count\n${count}`;
});

// If the rule is not there, add it
const ruleText = "매번 Agent.md를 읽을 때마다 문서 맨 뒤에 있는 숫자를 1씩 증가시킬 것.";
if (!newContent.includes(ruleText)) {
  newContent = newContent.replace("### Agent Read Count", `> **관제 규칙:** ${ruleText}\n\n### Agent Read Count`);
}

fs.writeFileSync("AGENTS.md", newContent, "utf-8");
console.log("Updated AGENTS.md with new rule and incremented count.");
