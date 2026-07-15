import { Innertube } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create();
  // We have Le Sserafim's youtube channel: https://youtube.com/@LESSERAFIM_official
  const channel = await yt.getChannel('@LESSERAFIM_official');
  const about = await channel.getAbout();
  
  console.log("Links:", about.links);
}
run().catch(console.error);
