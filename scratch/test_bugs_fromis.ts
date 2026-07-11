import * as cheerio from "cheerio";

async function testSearch(artist: string) {
  const url = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent(artist)}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log(`Search Results for ${artist}:`);
    const rows = $("div#albumList table.list.albumList tbody tr");
    console.log("Rows count:", rows.length);
    rows.each((i, el) => {
      const albumId = $(el).attr("albumid");
      const title = $(el).find("p.title a").text().trim();
      const artistName = $(el).find("p.artist a").text().trim();
      console.log(`[${i}] ID: ${albumId} | Title: ${title} | Artist: ${artistName}`);
    });
  } catch (err) {
    console.error("Error searching Bugs:", err);
  }
}

testSearch("fromis_9");
