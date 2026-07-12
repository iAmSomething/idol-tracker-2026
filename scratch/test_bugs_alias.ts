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
    const tableText = $detail('table.info').text().replace(/\s+/g, ' ');
    const h1Text = $detail('header.sectionPadding h1').text().trim();
    
    console.log(`Query: "${artistName}"\nH1: ${h1Text}\nTable: ${tableText}\n`);
    
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}

testBugsSearch("베이온");
