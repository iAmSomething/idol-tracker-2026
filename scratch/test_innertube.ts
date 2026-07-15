import { Innertube } from 'youtubei.js';

async function test() {
  try {
    const yt = await Innertube.create();
    
    // Resolve custom URL to channel ID
    const urlInfo = await yt.resolveURL('https://www.youtube.com/@IVEstarship');
    const channelId = urlInfo.payload.browseId;
    console.log('Channel ID:', channelId);
    
    const chan = await yt.getChannel(channelId);
    const community = await chan.getCommunity();
    
    if (community.posts) {
      for (const post of community.posts.slice(0, 5)) {
        console.log('-----------------');
        console.log(post.content?.text);
      }
    } else {
      console.log('No posts found.');
    }
  } catch (e) {
    console.error(e);
  }
}
test();
