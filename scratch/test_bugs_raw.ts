async function test() {
  const res = await fetch("https://music.bugs.co.kr/search/album?q=fromis_9", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log("Status:", res.status);
  console.log("HTML length:", html.length);
  console.log("HTML slice:", html.substring(0, 1000));
}
test();
