import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger';
import { parseArticleWithQwen } from './qwen_extractor';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

export interface NaverNewsItem {
  title: string;
  link: string;
  pubDate: string;
}

export interface NaverScrapedData {
  content: string;
  officialImageUrl?: string;
  artistName?: string;
  title?: string;
  releaseDate?: string;
  releaseType?: 'full' | 'mini' | 'single';
  artistType?: 'group' | 'solo' | 'unit' | 'band';
  isMusicComeback?: boolean;
  summary?: string;
}

// 1. Fetch Naver News API
export async function searchNaverNews(query: string, display: number = 20): Promise<NaverNewsItem[]> {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
  try {
    const res = await axios.get(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      },
      timeout: 5000
    });
    
    return (res.data.items || [])
      .map((item: any) => ({
        title: item.title.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
        link: item.link,
        pubDate: item.pubDate
      }))
      .filter((item: any) => {
        const upperTitle = item.title.toUpperCase();
        return !upperTitle.includes('OST') && !upperTitle.includes('사운드트랙');
      });
  } catch (e: any) {
    logger.error(`Naver News API error: ${e.message}`);
    return [];
  }
}

// 2. Scrape Naver News Content (only m.entertain.naver.com)
export async function scrapeNaverNewsContent(url: string, pubDate: string, targetArtist?: string): Promise<NaverScrapedData | null> {
  if (!url.includes('n.news.naver.com') && !url.includes('entertain.naver.com')) {
    return null;
  }

  try {
    const res = await axios.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const title = $('#title_area span').text().trim() || $('.end_tit').text().trim() || $('title').text().trim();
    let content = $('#dic_area').text().trim() || $('#articeBody').text().trim();
    content = content.replace(/\s+/g, ' ');

    const data: NaverScrapedData = { content };

    // --- A. Extract Official Image ---
    $('.end_photo_org, .nbd_im_w, .photo_center, .img_wrap').each((i, el) => {
      const imgSrc = $(el).find('img').attr('src');
      const caption = $(el).find('.img_desc, em').text().trim();
      
      if (imgSrc && caption) {
        if (/(제공|엔터테인먼트|소속사|사진=)/.test(caption)) {
          data.officialImageUrl = imgSrc;
          return false;
        }
      }
    });

    if (!data.officialImageUrl) {
        const firstImg = $('.end_photo_org img, .nbd_im_w img, .photo_center img').first().attr('src');
        if (firstImg) data.officialImageUrl = firstImg;
    }

    // --- B. Extract Info using local Qwen3 ---
    // Use the page title (usually inside <title>) for context
    const articleTitle = $('title').text().trim() || 'No Title';
    const qwenInfo = await parseArticleWithQwen(content, articleTitle, pubDate, targetArtist);

    if (qwenInfo) {
      if (qwenInfo.artistName) {
        data.artistName = qwenInfo.artistName;
      }
      
      if (qwenInfo.date) {
        // Simple sanity check or normalization can go here
        data.releaseDate = qwenInfo.date;
      }
      
      if (qwenInfo.type === 'full' || qwenInfo.type === 'mini' || qwenInfo.type === 'single') {
        data.releaseType = qwenInfo.type as any;
      }
      
      if (qwenInfo.artistType === 'group' || qwenInfo.artistType === 'solo' || qwenInfo.artistType === 'unit') {
        data.artistType = qwenInfo.artistType as any;
      }

      if (typeof qwenInfo.isMusicComeback === 'boolean') {
        data.isMusicComeback = qwenInfo.isMusicComeback;
      }

      if (qwenInfo.summary) {
        data.summary = qwenInfo.summary;
      }

      if (qwenInfo.title) {
        data.title = qwenInfo.title;
      }
    } else {
      logger.warn(`Qwen3 extraction failed or timed out for ${url}. Falling back to basic regex is skipped for now.`);
    }

    return data;
  } catch (e: any) {
    logger.error(`Naver News scraping error (${url}): ${e.message}`);
    return null;
  }
}
