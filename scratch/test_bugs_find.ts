import * as cheerio from "cheerio";

async function test() {
  const res = await fetch("https://music.bugs.co.kr/search/album?q=fromis_9", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Find the element containing "Supersonic"
  $(":contains('Supersonic')").each((i, el) => {
    if ($(el).children().length === 0 || $(el).attr("class") || $(el).attr("id")) {
      console.log(`Tag: ${el.tagName} | ID: ${$(el).attr("id")} | Class: ${$(el).attr("class")} | Text: ${$(el).text().trim().substring(0, 100)}`);
    }
  });
}
test();
