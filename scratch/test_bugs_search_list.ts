import axios from 'axios';
import * as cheerio from 'cheerio';

async function testBugsSearch(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    const resultHtml = $search('ul.list').html();
    console.log(resultHtml);
    
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}

testBugsSearch("베이온");
