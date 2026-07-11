import { Innertube } from 'youtubei.js';

async function test() {
  const youtube = await Innertube.create();
  const search = await youtube.search('빅뱅 컴백', { sort_by: 'upload_date', type: 'video' });
  
  console.log('Results:');
  for (const video of search.videos.slice(0, 5)) {
    if (video.type === 'Video') {
      console.log(`- [${video.published.text}] ${video.title.text}`);
    }
  }
}
test();
