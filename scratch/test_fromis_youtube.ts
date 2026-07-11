import ytSearch from 'yt-search';

async function run() {
  const r = await ytSearch("프로미스나인 official channel");
  const channel = r.channels[0];
  if (channel) {
    console.log("Found Channel:", channel.name, channel.url);
  } else {
    console.log("No channel found");
  }
}
run();
