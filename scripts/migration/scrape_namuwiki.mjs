import * as cheerio from 'cheerio';
import fs from 'fs';

async function fetchAllGroups(startUrl) {
  const groups = new Set();
  let currentUrl = startUrl;
  
  while (currentUrl) {
    console.log(`Fetching ${currentUrl}...`);
    const res = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let added = 0;
    $('ul > li > a').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href');
      // Categories format groups as normal links. Filter out non-group links if possible.
      if (href && href.startsWith('/w/') && !href.includes(':')) {
        groups.add(title);
        added++;
      }
    });

    let nextLink = null;
    $('a').each((_, el) => {
      if ($(el).text().trim() === '다음') {
        nextLink = 'https://namu.wiki' + $(el).attr('href');
      }
    });
    
    if (!nextLink || nextLink === currentUrl || added === 0) {
      break;
    }
    currentUrl = nextLink;
    // Add a small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return Array.from(groups);
}

async function main() {
  const urls = [
    'https://namu.wiki/w/%EB%B6%84%EB%A5%98:%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98%20%EA%B1%B8%EA%B7%B8%EB%A3%B9',
    'https://namu.wiki/w/%EB%B6%84%EB%A5%98:%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98%20%EB%B3%B4%EC%9D%B4%EA%B7%B8%EB%A3%B9',
    'https://namu.wiki/w/%EB%B6%84%EB%A5%98:%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98%20%ED%98%BC%EC%84%B1%EA%B7%B8%EB%A3%B9'
  ];

  let allGroups = new Set();
  for (const url of urls) {
    const list = await fetchAllGroups(url);
    list.forEach(g => allGroups.add(g));
  }

  fs.writeFileSync('namu_raw.json', JSON.stringify(Array.from(allGroups), null, 2));
  console.log(`Saved ${allGroups.size} total unique groups to namu_raw.json`);
}

main().catch(console.error);
