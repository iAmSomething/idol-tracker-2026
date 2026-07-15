import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Innertube from "youtubei.js";

async function testMelon(artist: string, album: string) {
  const query = encodeURIComponent(`${artist} ${album}`);
  const url = `https://www.melon.com/search/album/index.htm?q=${query}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Try to find the album link in Melon search results
  const firstAlbumLink = $("a.thumb").first().attr("href");
  console.log("Melon first album link href:", firstAlbumLink);
  const albumIdMatch = firstAlbumLink?.match(/javascript:melon\.link\.goAlbumDetail\('(\d+)'\)/);
  if (albumIdMatch) {
    console.log(`Melon Link: https://www.melon.com/album/detail.htm?albumId=${albumIdMatch[1]}`);
  }
}

async function testYouTubeMusic(artist: string, album: string) {
  const yt = await Innertube.create();
  const results = await yt.music.search(`${artist} ${album}`, { type: 'album' });
  const firstResult = results.albums?.contents?.[0] as any;
  if (firstResult) {
     console.log(`YouTube Music Link: https://music.youtube.com/browse/${firstResult.endpoint?.payload?.browseId}`);
  } else {
     console.log("No YT Music album found.");
  }
}

async function testSpotify(artist: string, album: string) {
  // Odesli API using an iTunes link
  const url = `https://api.song.link/v1-alpha.1/links?url=https://music.apple.com/kr/album/armageddon-the-1st-album/1745285216?uo=4`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Spotify Link:", data.linksByPlatform?.spotify?.url);
  console.log("Odesli Full Platforms:", Object.keys(data.linksByPlatform || {}));
}

testMelon("aespa", "Armageddon");
testYouTubeMusic("aespa", "Armageddon");
testSpotify("aespa", "Armageddon");
