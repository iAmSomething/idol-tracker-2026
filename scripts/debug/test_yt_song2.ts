import Innertube from "youtubei.js";

async function run() {
  const yt = await Innertube.create();
  const results = await yt.music.search("이민혁 TEMPERATURE", { type: "song" });
  console.log("Keys:", Object.keys(results));
  console.log(JSON.stringify(results.contents, null, 2));
}
run();
