import * as cheerio from 'cheerio';
const res = await fetch('https://music.bugs.co.kr/album/4149078');
const html = await res.text();
const $ = cheerio.load(html);
$("table.list.trackList tbody tr[rowtype='track']").each((_, el) => {
  const title = $(el).find('p.title a').first().text().trim();
  const isTitle = $(el).find('span.albumTitle').text().includes('타이틀곡');
  const mvid = $(el).attr('mvid');
  console.log({ title, isTitle, mvid });
});
