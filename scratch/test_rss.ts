import Parser from "rss-parser";

const parser = new Parser();

async function testRss() {
  const queryStr = encodeURIComponent(`"브브걸" ("컴백" OR "데뷔" OR "신곡")`);
  const url = `https://news.google.com/rss/search?q=${queryStr}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await parser.parseURL(url);
  
  if (feed.items.length > 0) {
    const item = feed.items[0];
    console.log("Title:", item.title);
    console.log("ContentSnippet:", item.contentSnippet);
    console.log("Content:", item.content);
  }
}

testRss();
