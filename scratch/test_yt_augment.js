const https = require('https');

async function fetchYoutubeCommunity(channelUrl) {
  return new Promise((resolve, reject) => {
    https.get(`${channelUrl}/posts`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const start = data.indexOf('var ytInitialData = {');
          if (start === -1) return resolve([]);
          const endStr = '};</script>';
          const end = data.indexOf(endStr, start);
          if (end === -1) return resolve([]);
          const jsonStr = data.substring(start + 20, end + 1);
          
          const ytInitialData = JSON.parse(jsonStr);
          const tabs = ytInitialData.contents?.twoColumnBrowseResultsRenderer?.tabs;
          if (!tabs) return resolve([]);
          
          const communityTab = tabs.find(t => t.tabRenderer?.title === '게시물' || t.tabRenderer?.title === 'Community' || t.tabRenderer?.title === '커뮤니티' || t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/posts') || t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/community'));
          if (!communityTab) return resolve([]);
          
          const items = communityTab.tabRenderer?.content?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
          if (!items) return resolve([]);
          
          const posts = [];
          for (const item of items) {
            const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
            if (post) {
              let text = '';
              const textRuns = post.contentText?.runs;
              if (textRuns) {
                text = textRuns.map(r => r.text).join('');
              }

              let imageUrl = null;
              let videoUrl = null;

              // Image attachments
              const backstageAttachment = post.backstageAttachment;
              if (backstageAttachment?.backstageImageRenderer) {
                const thumbnails = backstageAttachment.backstageImageRenderer.image.thumbnails;
                imageUrl = thumbnails[thumbnails.length - 1].url;
              } else if (backstageAttachment?.postMultiImageRenderer) {
                const images = backstageAttachment.postMultiImageRenderer.images;
                if (images.length > 0) {
                  const thumbnails = images[0].backstageImageRenderer.image.thumbnails;
                  imageUrl = thumbnails[thumbnails.length - 1].url;
                }
              }

              // Video attachments
              if (backstageAttachment?.videoRenderer) {
                const videoId = backstageAttachment.videoRenderer.videoId;
                videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
              }

              // URLs inside text
              if (!videoUrl && textRuns) {
                for (const run of textRuns) {
                  if (run.navigationEndpoint?.urlEndpoint?.url) {
                    const u = run.navigationEndpoint.urlEndpoint.url;
                    if (u.includes('youtube.com/watch') || u.includes('youtu.be/')) {
                      videoUrl = u;
                    }
                  }
                }
              }

              posts.push({ text, imageUrl, videoUrl });
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

fetchYoutubeCommunity('https://www.youtube.com/@ENHYPENOFFICIAL').then(posts => {
  for (const p of posts) {
    console.log(p.text.substring(0, 50).replace(/\\n/g, ' '));
    console.log(" IMG:", p.imageUrl);
    console.log(" VID:", p.videoUrl);
    console.log("---");
  }
}).catch(console.error);
