const Parser = require('rss-parser');
const parser = new Parser({
  customFields: {
    item: ['description']
  }
});

async function test() {
  const qStr = `"아이브" 컴백 when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(qStr)}&hl=ko&gl=KR&ceid=KR:ko`;
  console.log('Fetching URL:', url);
  try {
    const feed = await parser.parseURL(url);
    console.log('Feed items count:', feed.items.length);
    console.log('First item title:', feed.items[0]?.title);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
