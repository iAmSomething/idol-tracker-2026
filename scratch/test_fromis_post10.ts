async function fetchPost10(channelUrl: string) {
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
    
    if (items && items[10]) {
      const item = items[10];
      console.log("Raw Item 10 keys:", Object.keys(item));
      const post = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
      if (post) {
        const text = post.contentText?.runs?.map((r: any) => r.text).join('') || '';
        console.log("Post 10 Text:", text);
      } else {
        console.log("No post renderer found in item 10");
        console.log(JSON.stringify(item, null, 2));
      }
    } else {
      console.log("No item 10");
    }
  } catch (e) {
    console.error(e);
  }
}
fetchPost10("https://youtube.com/@fromis9_official");
