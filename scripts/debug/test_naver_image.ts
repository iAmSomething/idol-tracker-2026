import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const urls = [
      'https://m.entertain.naver.com/article/410/0001132241',
      'https://m.entertain.naver.com/article/119/0002829286'
  ];
  for (const url of urls) {
      console.log('--- URL:', url);
      const res = await axios.get(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
      const $ = cheerio.load(res.data);
  
      // Naver m.entertain usually uses these classes for images
      $('.end_photo_org, .nbd_im_w, .photo_center, .img_wrap').each((i, el) => {
        const imgSrc = $(el).find('img').attr('src');
        const caption = $(el).find('.img_desc, em').text().trim();
        if (imgSrc) {
          console.log('Image:', imgSrc);
          console.log('Caption:', caption);
        }
      });
  }
}
test();
