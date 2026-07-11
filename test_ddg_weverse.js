import { search } from 'duck-duck-scrape';

async function run() {
  const query = "site:weverse.io LE SSERAFIM";
  const results = await search(query);
  console.log(results.results[0]);
}
run();
