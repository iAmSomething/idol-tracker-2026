import axios from "axios";
import * as cheerio from "cheerio";

async function testNaver() {
  const query = encodeURIComponent("브브걸 컴백");
  const url = `https://search.naver.com/search.naver?where=news&query=${query}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(res.data);
    
    // Find the first news article
    const firstNews = $(".news_area").first();
    const title = firstNews.find(".news_tit").text();
    const link = firstNews.find(".info_group a.info").last().attr("href"); // Usually the Naver News link
    const snippet = firstNews.find(".news_dsc").text();
    
    console.log("Title:", title);
    console.log("Link:", link);
    console.log("Snippet:", snippet);
    
    // If it's a Naver News link, we can fetch the body easily!
    if (link && link.includes("n.news.naver.com")) {
      const articleRes = await axios.get(link, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const $article = cheerio.load(articleRes.data);
      const body = $article("#dic_area").text().replace(/\s+/g, " ").trim();
      console.log("Body length:", body.length);
      console.log("Body snippet:", body.substring(0, 300));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

testNaver();
