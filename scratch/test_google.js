const googleIt = require('google-it');

async function run() {
  try {
    const results = await googleIt({ query: 'site:weverse.io LE SSERAFIM', limit: 1 });
    console.log(results);
  } catch (err) {
    console.error(err);
  }
}
run();
