import { search } from 'duck-duck-scrape';
async function test() {
  const r = await search('LE SSERAFIM official instagram');
  console.log(r.results.slice(0, 2));
}
test();
