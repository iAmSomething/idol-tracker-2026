import axios from "axios";
import * as cheerio from "cheerio";

async function fetchArticle(url: string) {
  try {
    let res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    // Check for meta refresh
    const metaRefreshMatch = res.data.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?[^;]+;\s*url=([^"'>]+)["']?/i);
    if (metaRefreshMatch) {
      const redirectUrl = metaRefreshMatch[1].replace(/&amp;/g, '&');
      console.log("Following meta refresh to:", redirectUrl);
      res = await axios.get(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
    }

    const $ = cheerio.load(res.data);
    const text = $("body").text().replace(/\s+/g, ' ');
    console.log("Snippet:", text.substring(0, 1000));
    
    // Test Regex
    const typeMatch = text.match(/새\s*(싱글|미니\s*앨범|정규\s*앨범|EP|앨범)\s*['"‘“]([^'"’”]+)['"’”]/);
    if (typeMatch) {
      console.log("Type:", typeMatch[1]);
      console.log("Album:", typeMatch[2]);
    }

    const dateMatch = text.match(/(?:오는|다음달)\s*(\d{1,2})일\s*(오전|오후)?\s*(\d{1,2})?시?/);
    if (dateMatch) {
      console.log("Date match:", dateMatch[0]);
    }
    
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

fetchArticle("https://news.google.com/rss/articles/CBMiV0FVX3lxTE1nbTBybzJ0dEJld3hQV3M5cGI2RllRWndWYjd6bl9hSkNxbXNzcUpvVTVrWnFYYmc2WHliRGJtVDRhclFGSVFWbFNCV1drNzJMaU5Qc1NBTQ?oc=5");
