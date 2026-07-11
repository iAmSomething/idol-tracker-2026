import { Innertube } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create();
  try {
    const urlInfo = await yt.resolveURL("https://youtube.com/@fromis9_official");
    const channelId = urlInfo.payload.browseId;
    if (!channelId) return;
    
    const chan = await yt.getChannel(channelId);
    const community = await chan.getCommunity();
    
    console.log("Initial posts count:", community.posts?.length);
    
    let posts = [...(community.posts || [])];
    
    // Fetch next page if possible
    if (community.has_continuation) {
      console.log("Fetching next page...");
      const nextPage = await community.getContinuation();
      if (nextPage.posts) {
        posts.push(...nextPage.posts);
      }
      console.log("Total posts count after 1 continuation:", posts.length);
    }
    
    posts.forEach((post: any, i: number) => {
      const text = post.content?.text || '';
      console.log(`\n--- Post ${i} ---`);
      console.log(text.substring(0, 300));
      if (text.includes("TRACK") || text.includes("Track") || text.includes("수록곡") || text.includes("트랙") || text.includes("Title") || text.includes("TITLE")) {
        console.log("🌟 CONTAINS TRACKLIST!");
        console.log(text);
      }
    });
  } catch (e) {
    console.error(e);
  }
}
run();
