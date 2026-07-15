import * as cheerio from 'cheerio';

async function fetchNamu(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const groups = [];
  // Namuwiki category items are usually in ul > li > a
  $('ul > li > a').each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');
    if (href && href.startsWith('/w/')) {
      groups.push(title);
    }
  });

  // Find next link
  let nextLink = null;
  $('a').each((_, el) => {
    if ($(el).text().trim() === '다음') {
      nextLink = $(el).attr('href');
    }
  });

  console.log(`Found ${groups.length} groups.`);
  console.log(`Next link: ${nextLink}`);
  return { groups, nextLink };
}

fetchNamu('https://namu.wiki/w/%EB%B6%84%EB%A5%98:%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98%20%EA%B1%B8%EA%B7%B8%EB%A3%B9').catch(console.error);
