import Innertube from "youtubei.js";

async function run() {
  const yt = await Innertube.create();
  const results = await yt.music.search("aespa Armageddon", { type: "video" });
  console.log("Videos:", results.videos?.contents?.length);
  if (results.videos?.contents?.[0]) {
    const first: any = results.videos.contents[0];
    console.log("ID:", first.id);
  }
}
run();
