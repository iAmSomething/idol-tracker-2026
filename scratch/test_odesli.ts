import fetch from "node-fetch";

async function testOdesliYT() {
  const url = `https://api.song.link/v1-alpha.1/links?url=https://music.youtube.com/browse/MPREb_p9wPkOccFdL`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Odesli Full Platforms (from YT):", Object.keys(data.linksByPlatform || {}));
  if (data.linksByPlatform?.spotify) {
    console.log("Spotify Link:", data.linksByPlatform.spotify.url);
  }
}

testOdesliYT();
