import { fetchYouTubeCommunityInfo } from "../scripts/lib/youtube_scraper";

async function test() {
  console.log("=== Test 1: 브브걸 (no official URL, yt-search fallback) ===");
  const r1 = await fetchYouTubeCommunityInfo("브브걸");
  console.log("Result:", JSON.stringify(r1, null, 2));

  console.log("\n=== Test 2: 슈퍼주니어 (yt-search fallback) ===");
  const r2 = await fetchYouTubeCommunityInfo("슈퍼주니어");
  console.log("Result:", JSON.stringify(r2, null, 2));

  console.log("\n=== Test 3: 에스파 (yt-search fallback) ===");
  const r3 = await fetchYouTubeCommunityInfo("에스파");
  console.log("Result:", JSON.stringify(r3, null, 2));
}

test().catch(console.error);
