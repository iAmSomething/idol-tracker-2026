import Innertube from "youtubei.js";

async function run() {
  const yt = await Innertube.create();
  const results = await yt.music.search("aespa Armageddon", { type: "song" });
  console.log("Keys:", Object.keys(results));
  console.log(JSON.stringify(results.songs?.contents?.slice(0, 2), null, 2));
}
run();
