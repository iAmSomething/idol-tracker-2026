import ytSearch from 'yt-search';
async function test() {
  const r = await ytSearch('LE SSERAFIM official channel');
  console.log(r.channels.slice(0, 2));
}
test();
