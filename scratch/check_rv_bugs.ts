import axios from "axios";
import * as cheerio from "cheerio";

async function run() {
  const searchUrl = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent("레드벨벳")}`;
  const res = await axios.get(searchUrl, { timeout: 5000 });
  const $ = cheerio.load(res.data);
  
  $('figure.albumInfo').each((i, el) => {
    const title = $(el).find('.albumTitle a').text().trim();
    const artist = $(el).find('.artist a').first().text().trim() || $(el).find('.artistTitle').first().text().trim();
    const releaseDateRaw = $(el).find('time').text().trim(); // "2026.06.17"
    console.log(`${title} | ${artist} | ${releaseDateRaw}`);
  });
}
run().catch(console.error);
