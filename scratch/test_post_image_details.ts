import { Innertube } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create();
  const urlInfo = await yt.resolveURL("https://youtube.com/@fromis9_official");
  const channelId = urlInfo.payload.browseId;
  if (!channelId) return;
  const chan = await yt.getChannel(channelId);
  const community = await chan.getCommunity();
  
  const posts = community.posts || [];
  const multiImagePost = posts.find(p => p.attachment?.type === 'PostMultiImage');
  if (multiImagePost) {
    const images = multiImagePost.attachment.images;
    console.log(JSON.stringify(images[0], null, 2));
  }
}
run();
