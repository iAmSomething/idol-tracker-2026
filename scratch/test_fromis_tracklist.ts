async function fetchAllCommunity(channelUrl: string) {
  const url = channelUrl.replace('https://youtube.com', 'https://www.youtube.com') + '/posts';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const data = await res.text();
    const start = data.indexOf('var ytInitialData = {');
    const jsonStr = data.substring(start + 20, data.indexOf('};</script>', start) + 1);
    const ytInitialData = JSON.parse(jsonStr);
    const items = ytInitialData.contents?.twoColumnBrowseResultsRenderer?.tabs?.find((t: any) => 
      t.tabRenderer?.title === '게시물' || t.tabRenderer?.title === 'Community' || t.tabRenderer?.title === '커뮤니티'
    )?.tabRenderer?.content?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
    
    if (!items) return;
    items.forEach((item: any, i: number) => {
      const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
      if (post) {
        const text = post.contentText?.runs?.map((r: any) => r.text).join('') || '';
        console.log(`\n--- Post ${i} ---`);
        console.log("Text:", text.substring(0, 100));
        if (text.includes("Track") || text.includes("TRACK") || text.includes("트랙") || text.includes("수록곡") || text.includes("Title") || text.includes("TITLE")) {
          console.log("🌟 CONTAINS TRACKLIST KEYWORD!");
          console.log(text);
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
}
fetchAllCommunity("https://youtube.com/@fromis9_official");
