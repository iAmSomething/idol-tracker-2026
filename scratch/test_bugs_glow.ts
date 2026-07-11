import * as cheerio from "cheerio";

async function test() {
  const res = await fetch("https://music.bugs.co.kr/search/album?q=" + encodeURIComponent("글로우 미"), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("music.bugs.co.kr/album/") || href.startsWith("/album/")) {
      console.log(`Href: ${href} | Text: ${$(el).text().trim()}`);
    }
  });
}
test();
