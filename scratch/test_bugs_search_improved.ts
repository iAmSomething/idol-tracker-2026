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
    $("ul.albumList li").each((i, el) => {
      const albumTitleLink = $(el).find("div.albumTitle a");
      const title = albumTitleLink.text().trim();
      const href = albumTitleLink.attr("href") || "";
      const match = href.match(/\/album\/(\d+)/);
      const albumId = match ? match[1] : null;
      
      const artistName = $(el).find("p.artist a").text().trim();
      const releaseDate = $(el).find("time").text().trim();
      const albumType = $(el).find("span.albumType").text().trim(); // Or class name
      
      console.log(`[${i}] ID: ${albumId} | Title: ${title} | Artist: ${artistName} | Date: ${releaseDate}`);
    });
  } catch (err) {
    console.error("Error searching Bugs:", err);
  }
}

testSearch("fromis_9");
