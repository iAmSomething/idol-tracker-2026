import { chromium } from "playwright";

async function testPlaywright() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  // BBGIRLS URL
  const url1 = "https://news.google.com/rss/articles/CBMiV0FVX3lxTE1nbTBybzJ0dEJld3hQV3M5cGI2RllRWndWYjd6bl9hSkNxbXNzcUpvVTVrWnFYYmc2WHliRGJtVDRhclFGSVFWbFNCV1drNzJMaU5Qc1NBTQ?oc=5";
  
  // SUPER JUNIOR URL (Let's find the URL from the db if needed, or just test one)
  
  console.log("Navigating to URL...");
  await page.goto(url1, { waitUntil: "domcontentloaded", timeout: 15000 });
  
  // Wait a bit for redirect
  await page.waitForTimeout(3000);
  
  console.log("Current URL after redirect:", page.url());
  
  const bodyText = await page.evaluate(() => {
    return document.body.innerText.replace(/\s+/g, ' ');
  });
  
  console.log("Body snippet:", bodyText.substring(0, 1000));
  
  // Test Regex extraction
  console.log("\n--- Extraction Results ---");
  
  // 1. Album Type
  const typeMatch = bodyText.match(/(미니\s*\d+집|새\s*싱글|정규\s*\d+집|데뷔\s*앨범|싱글\s*\d+집|EP|디지털\s*싱글|더블\s*싱글)/i);
  if (typeMatch) console.log("Album Type:", typeMatch[1]);
  
  // 2. Album Title (Look for words near the type)
  // E.g. 새 싱글 'BODY WAVE' -> look for quotes nearby
  const titleMatch = bodyText.match(/(?:싱글|앨범|미니|정규|타이틀곡|신곡).*?['"‘“]([^'"’”]+)['"’”]/);
  if (titleMatch) console.log("Album Title:", titleMatch[1]);
  
  // 3. Exact Date (Look for "오는 XX일" or "X월 X일")
  const dateMatch = bodyText.match(/(?:오는|다음달|이달)?\s*(?:(\d{1,2})월\s*)?(\d{1,2})일\s*(?:오후\s*(\d{1,2})시)?/);
  if (dateMatch) {
    console.log("Full Date Match:", dateMatch[0]);
    console.log("Month:", dateMatch[1] || "Current");
    console.log("Day:", dateMatch[2]);
  }

  await browser.close();
}

testPlaywright().catch(console.error);
