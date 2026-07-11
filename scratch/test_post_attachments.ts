import { Innertube } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create();
  const urlInfo = await yt.resolveURL("https://youtube.com/@fromis9_official");
  const channelId = urlInfo.payload.browseId;
  if (!channelId) return;
  
  const chan = await yt.getChannel(channelId);
  const community = await chan.getCommunity();
  
  const posts = community.posts || [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n--- Post ${i} ---`);
    console.log("Keys:", Object.keys(post));
    console.log("Content Keys:", post.content ? Object.keys(post.content) : "null");
    if (post.attachment) {
      console.log("Attachment Keys:", Object.keys(post.attachment));
      console.log("Attachment Type:", post.attachment.type);
      if (post.attachment.image) {
        console.log("Image Thumbnails:", post.attachment.image.thumbnails);
      }
      if (post.attachment.video) {
        console.log("Video ID:", post.attachment.video.id);
      }
    }
  }
}
run();
