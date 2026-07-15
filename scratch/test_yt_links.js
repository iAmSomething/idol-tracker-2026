const https = require('https');

async function fetchYoutubeLinks(channelUrl) {
  return new Promise((resolve, reject) => {
    https.get(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const match = data.match(/var ytInitialData = (\{.*?\});<\/script>/);
          if (!match) {
            console.log("No ytInitialData found.");
            return resolve(null);
          }
          
          const ytInitialData = JSON.parse(match[1]);
          console.log("Parsed ytInitialData successfully.");
          
          // Find the links
          // They are usually in header -> c4TabbedHeaderRenderer -> headerLinks -> channelHeaderLinksRenderer -> primaryLinks / secondaryLinks
          // OR in the about channel view.
          
          const header = ytInitialData.header?.c4TabbedHeaderRenderer || ytInitialData.header?.pageHeaderRenderer;
          
          let links = [];
          
          // Strategy 1: pageHeaderRenderer (new UI)
          if (header?.content?.pageHeaderViewModel?.links?.headerLinksPosition?.channelHeaderLinksViewModel?.links) {
            const headerLinks = header.content.pageHeaderViewModel.links.headerLinksPosition.channelHeaderLinksViewModel.links;
            for (const link of headerLinks) {
              const url = link.channelHeaderLinkViewModel?.title?.content; 
              // Wait, the url is usually in the command
              const commandUrl = link.channelHeaderLinkViewModel?.command?.urlEndpoint?.url;
              if (commandUrl) links.push(commandUrl);
            }
          }
          
          console.log("Found links:", links);
          resolve(links);
          
        } catch (e) {
          console.error(e);
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

fetchYoutubeLinks('https://www.youtube.com/@IVEstarship');
