import { scrapeBugsLatestAlbums } from '../scripts/lib/bugs_scraper';

async function test() {
  const albums = await scrapeBugsLatestAlbums();
  console.log("Albums found:", albums.length);
  if (albums.length > 0) {
    console.log(albums[0]);
  }
}
test();
