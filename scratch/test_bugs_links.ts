import * as cheerio from "cheerio";

async function test() {
  const res = await fetch("https://music.bugs.co.kr/search/album?q=fromis_9", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Let's find any album id or list of albums
  console.log("Album links:");
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("music.bugs.co.kr/album/") || href.startsWith("/album/")) {
      console.log(`Href: ${href} | Text: ${$(el).text().trim()}`);
    }
  });
}
test();
