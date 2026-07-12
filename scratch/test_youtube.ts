import { Innertube } from 'youtubei.js';
import ytSearch from 'yt-search';

async function testYouTubeCommunity() {
  const artistName = '브브걸';
  console.log(`Searching for channel: ${artistName}`);
  
  const searchResult = await ytSearch(artistName);
  const channels = searchResult.channels;
  if (channels.length === 0) return;
  
  const officialChannel = channels[0];
  console.log(`Found channel: ${officialChannel.name} (${officialChannel.url})`);
  
  try {
    const youtube = await Innertube.create();
    
    // Resolve handle URL to get the browse ID (Channel ID)
    const resolveParams = await youtube.resolveURL(officialChannel.url);
    if (!resolveParams || !resolveParams.payload || !resolveParams.payload.browseId) {
      console.log('Could not resolve channel ID');
      return;
    }
    const channelId = resolveParams.payload.browseId;
    console.log(`Resolved Channel ID: ${channelId}`);
    
    const channel = await youtube.getChannel(channelId);
    const community = await channel.getCommunity();
    
    console.log(`Found ${community.posts.length} posts.`);
    for (const post of community.posts.slice(0, 3)) {
      let text = '';
      if (post.content) text = post.content.toString();
      else if (post.text) text = post.text.toString();
      else if (post.snippet) text = post.snippet.text.toString();
      console.log(`\n--- Post ---`);
      console.log(text.substring(0, 200) + '...');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testYouTubeCommunity();
