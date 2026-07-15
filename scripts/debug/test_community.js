const https = require('https');
const fs = require('fs');

async function testCommunity() {
  const url = 'https://www.youtube.com/@IVEstarship/community';
  https.get(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const match = data.match(/var ytInitialData = (\{.*?\});<\/script>/);
      if (match) {
        fs.writeFileSync('ive_community.json', match[1]);
        console.log('Saved to ive_community.json');
        
        // Attempt to extract texts
        const json = JSON.parse(match[1]);
        const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs;
        const communityTab = tabs.find(t => t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/community'));
        
        if (communityTab) {
          const items = communityTab.tabRenderer?.content?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
          if (items) {
            items.forEach((item, idx) => {
              const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer;
              if (post) {
                const text = post.contentText?.runs?.map(r => r.text).join('') || '';
                console.log(`[Post ${idx}]: ${text.substring(0, 100).replace(/\n/g, ' ')}...`);
              }
            });
          }
        }
      }
    });
  });
}
testCommunity();
