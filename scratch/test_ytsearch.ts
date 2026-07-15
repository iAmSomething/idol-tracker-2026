import ytSearch from "yt-search";

async function run() {
    const r = await ytSearch({ videoId: "is9J6Rn1F9w" });
    console.log(r.title);
}
run();
