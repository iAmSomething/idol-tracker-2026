import Innertube from "youtubei.js";
import util from "util";

async function run() {
  const yt = await Innertube.create();
  const results = await yt.music.search("aespa Armageddon");
  console.log(util.inspect(results.contents, { depth: 5, colors: true }));
}
run();
