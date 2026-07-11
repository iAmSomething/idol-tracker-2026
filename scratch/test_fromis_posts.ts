async function fetchYoutubeCommunity(channelUrl: string) {
  const url = channelUrl.replace('https://youtube.com', 'https://www.youtube.com') + '/posts';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) {
      console.log("Failed to fetch:", res.status);
      return;
    }
    
    const data = await res.text();
    const start = data.indexOf('var ytInitialData = {');
    if (start === -1) {
      console.log("No ytInitialData found");
      return;
    }
    const endStr = '};</script>';
    const end = data.indexOf(endStr, start);
    if (end === -1) {
      console.log("No end script tag found");
      return;
    }
    const jsonStr = data.substring(start + 20, end + 1);
    const ytInitialData = JSON.parse(jsonStr);
    const tabs = ytInitialData.contents?.twoColumnBrowseResultsRenderer?.tabs;
    if (!tabs) {
      console.log("No tabs found");
      return;
    }
    
    const communityTab = tabs.find((t: any) => 
      t.tabRenderer?.title === '게시물' || 
      t.tabRenderer?.title === 'Community' || 
      t.tabRenderer?.title === '커뮤니티' || 
      t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/posts')
    );
    if (!communityTab) {
      console.log("No community tab found");
      return;
    }
    
    const items = communityTab.tabRenderer?.content?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
    if (!items) {
      console.log("No items found");
      return;
    }
    
    console.log(`Found ${items.length} items on community tab.`);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
      if (post) {
        const text = post.contentText?.runs?.map((r: any) => r.text).join('') || '';
        console.log(`\n--- Post ${i} ---`);
        console.log(text.substring(0, 500));
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

fetchYoutubeCommunity("https://youtube.com/@fromis9_official");
