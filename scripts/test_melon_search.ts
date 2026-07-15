import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function test() {
  const url = `https://www.melon.com/search/album/index.htm?q=%EC%97%90%EC%8A%A4%ED%8C%8C+Armageddon`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const link = $("a.thumb").first().attr("href");
  console.log("Found link:", link);
}
test();
