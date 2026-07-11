import * as cheerio from "cheerio";

async function test() {
  const res = await fetch("https://music.bugs.co.kr/search/album?q=fromis_9", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Print all IDs and classes of main divs
  console.log("Section IDs:");
  $("section, div").each((_, el) => {
    const id = $(el).attr("id");
    const cl = $(el).attr("class");
    if (id || cl) {
      if (id?.includes("album") || cl?.includes("album") || id?.includes("search") || cl?.includes("search")) {
        console.log(`Tag: ${el.tagName} | ID: ${id} | Class: ${cl}`);
      }
    }
  });
}
test();
