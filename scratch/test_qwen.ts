import { parseArticleWithQwen } from "./scripts/lib/qwen_extractor";

const articleText = "DAY6(데이식스) 영케이가 9월 4일 첫 솔로 정규 앨범을 발매하고 컴백한다. 소속사 JYP엔터테인먼트는 16일 영케이의 솔로 컴백 소식을 알렸다.";
const title = "DAY6 영케이, 9월 4일 솔로 컴백 확정";

async function run() {
  const res = await parseArticleWithQwen(articleText, title);
  console.log(res);
}
run();
