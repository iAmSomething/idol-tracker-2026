import fetch from "node-fetch";

async function testSpotifyAuth() {
  const clientId = "fb060d60866448b8b2894db9422980c9";
  const clientSecret = "0be16f9116af4a0184b852752e0e0955";

  try {
    const authRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64")
      },
      body: "grant_type=client_credentials"
    });

    if (!authRes.ok) {
      console.log("Spotify Auth Failed:", await authRes.text());
      return;
    }

    const authData = await authRes.json();
    const token = authData.access_token;
    console.log("Got Spotify Token");

    const query = encodeURIComponent("aespa Armageddon");
    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (!searchRes.ok) {
      console.log("Spotify Search Failed:", await searchRes.text());
      return;
    }

    const searchData = await searchRes.json();
    const albumUrl = searchData.albums?.items?.[0]?.external_urls?.spotify;
    console.log("Spotify Album URL:", albumUrl);
  } catch(e) {
    console.error("Spotify Test Error:", e);
  }
}

testSpotifyAuth();
