import * as cheerio from "cheerio";

async function testSearch(artist: string, album: string) {
  const query = `${artist} ${album}`;
  const url = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent(query)}`;
  
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Find the first album item in the search results
    const firstAlbumRow = $("div#albumList table.list.albumList tbody tr").first();
    if (firstAlbumRow.length === 0) {
      console.log("No album found on Bugs search.");
      return;
    }
    
    const albumId = firstAlbumRow.attr("albumid");
    const title = firstAlbumRow.find("p.title a").text().trim();
    const artistName = firstAlbumRow.find("p.artist a").text().trim();
    const coverUrl = firstAlbumRow.find("a.thumbnail img").attr("src");
    
    console.log("Search Result:");
    console.log({
      albumId,
      title,
      artistName,
      coverUrl
    });
  } catch (err) {
    console.error("Error searching Bugs:", err);
  }
}

testSearch("프로미스나인", "글로우 미");
