import { scrapeBugsLatestAlbums } from "./lib/bugs_scraper";
import { searchNaverNews } from "./lib/naver_news_scraper";

async function run() {
  const albums = await scrapeBugsLatestAlbums();
  console.log("Latest bugs albums:", albums.slice(0, 20).map(a => `[${a.releaseDate}] ${a.artistName} - ${a.title}`));
}
run();
