import { Innertube } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create();
  const urlInfo = await yt.resolveURL("https://youtube.com/@Officialfromis9");
  const channelId = urlInfo.payload.browseId;
  console.log("Channel ID for @Officialfromis9:", channelId);
  
  const chan = await yt.getChannel(channelId);
  const community = await chan.getCommunity();
  
  let posts = [...(community.posts || [])];
  if (community.has_continuation) {
    const nextPage = await community.getContinuation();
    if (nextPage.posts) {
      posts.push(...nextPage.posts);
    }
  }
  
  console.log("Total posts count:", posts.length);
  posts.forEach((post: any, i: number) => {
    const text = post.content?.text || '';
    console.log(`[Post ${i}] length: ${text.length} | first line: ${text.split('\n')[0]}`);
  });
}
run();
