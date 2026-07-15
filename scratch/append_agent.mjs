import fs from "fs";
let content = fs.readFileSync("AGENTS.md", "utf-8");

if (!content.includes("### Agent Read Count")) {
  content += "\n\n### Agent Read Count\n0";
}

fs.writeFileSync("AGENTS.md", content, "utf-8");
