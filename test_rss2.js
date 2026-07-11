const https = require('https');

async function test() {
  const qStr = `"아이브" 컴백 when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(qStr)}&hl=ko&gl=KR&ceid=KR:ko`;
  
  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  }, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Length:', data.length);
      console.log('Preview:', data.substring(0, 200));
    });
  });
}
test();
