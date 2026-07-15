const https = require('https');

async function fetchYoutubeLinks(channelUrl) {
  return new Promise((resolve, reject) => {
    https.get(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Find URLs in the raw HTML
        const igMatch = data.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.-]+)/g);
        const twMatch = data.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)/g);
        const weverseMatch = data.match(/https?:\/\/(?:www\.)?weverse\.io\/[a-zA-Z0-9_.-]+/g);
        const tiktokMatch = data.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)/g);

        console.log("IG:", igMatch ? [...new Set(igMatch)] : []);
        console.log("TW:", twMatch ? [...new Set(twMatch)] : []);
        console.log("Weverse:", weverseMatch ? [...new Set(weverseMatch)] : []);
        console.log("TikTok:", tiktokMatch ? [...new Set(tiktokMatch)] : []);
      });
    }).on('error', reject);
  });
}

fetchYoutubeLinks('https://www.youtube.com/@IVEstarship');
