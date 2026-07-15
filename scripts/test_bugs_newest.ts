import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const res = await axios.get('https://music.bugs.co.kr/newest/album/total?nation=kr');
    const $ = cheerio.load(res.data);
    
    console.log("Bugs KR New Albums:");
    $('figure.albumInfo').slice(0, 5).each((i, el) => {
      const title = $(el).find('.albumTitle a').text().trim();
      const artist = $(el).find('.artist a').first().text().trim();
      const albumType = $(el).find('.albumType').text().trim() || 'Unknown';
      const releaseDate = $(el).find('time').text().trim();
      console.log(`${i+1}. [${artist}] ${title} (${albumType}) - ${releaseDate}`);
    });

  } catch (e) {
    console.error(e);
  }
}
test();
