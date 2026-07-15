import axios from 'axios';
import * as cheerio from 'cheerio';

async function testBugsSearch(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    const detailUrl = $search('figure.artistInfo a.thumbnail').first().attr('href');
    if (!detailUrl) {
      console.log(`Query: "${artistName}" -> No Result`);
      return;
    }

    const detailRes = await axios.get(detailUrl, { timeout: 5000 });
    const $detail = cheerio.load(detailRes.data);
    const artistTypeStr = $detail('table.info tbody tr').text().replace(/\s+/g, ' ');
    const actualName = $detail('header.sectionPadding h1').text().trim();
    
    console.log(`Query: "${artistName}" -> Bugs Name: "${actualName}" | Type String: "${artistTypeStr}"`);
    
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}

async function run() {
  await testBugsSearch("버스");
  await testBugsSearch("성장할");
  await testBugsSearch("청춘");
  await testBugsSearch("이즈나");
  await testBugsSearch("베이온");
}
run();
