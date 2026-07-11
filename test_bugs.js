import * as cheerio from 'cheerio';
const res = await fetch('https://music.bugs.co.kr/album/4149078');
const html = await res.text();
const $ = cheerio.load(html);
console.log($("table.list.trackList tbody tr[rowtype='track']").first().html());
