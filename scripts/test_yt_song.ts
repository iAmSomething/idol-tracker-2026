import Innertube from "youtubei.js";

async function run() {
  const yt = await Innertube.create();
  const results = await yt.music.search("이민혁 TEMPERATURE", { type: "song" });
  console.log(JSON.stringify(results.songs?.contents?.slice(0, 2), null, 2));
}
run();
