const https = require('https');

async function fetchYoutubeCommunity(channelUrl) {
  return new Promise((resolve, reject) => {
    https.get(`${channelUrl}/community`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const match = data.match(/var ytInitialData = (\{.*?\});<\/script>/);
          if (!match) return resolve([]);
          
          const ytInitialData = JSON.parse(match[1]);
          const tabs = ytInitialData.contents?.twoColumnBrowseResultsRenderer?.tabs;
          if (!tabs) return resolve([]);
          
          const communityTab = tabs.find(t => t.tabRenderer?.title === 'Community' || t.tabRenderer?.title === '커뮤니티' || t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/community'));
          if (!communityTab) return resolve([]);
          
          const items = communityTab.tabRenderer?.content?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
          if (!items) return resolve([]);
          
          const posts = [];
          for (const item of items) {
            const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
            if (post) {
              const textRuns = post.contentText?.runs;
              if (textRuns) {
                const text = textRuns.map(r => r.text).join('');
                posts.push({ text: text.substring(0, 100) + '...' });
              }
            }
          }
          
          resolve(posts);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

fetchYoutubeCommunity('https://www.youtube.com/@IVEstarship').then(console.log).catch(console.error);
