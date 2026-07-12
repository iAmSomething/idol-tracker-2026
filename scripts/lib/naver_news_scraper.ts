import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

export interface NaverNewsItem {
  title: string;
  link: string;
  pubDate: string;
}

export interface NaverScrapedData {
  content: string;
  releaseDate?: string;
  releaseType?: 'full' | 'mini' | 'single';
  artistType?: 'group' | 'solo' | 'unit' | 'band';
  officialImageUrl?: string;
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
    
    return (res.data.items || []).map((item: any) => ({
      title: item.title.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      link: item.link,
      pubDate: item.pubDate
    }));
  } catch (e: any) {
    logger.error(`Naver News API error: ${e.message}`);
    return [];
  }
}

// 2. Scrape Naver News Content (only m.entertain.naver.com)
export async function scrapeNaverNewsContent(url: string): Promise<NaverScrapedData | null> {
  if (!url.includes('n.news.naver.com') && !url.includes('entertain.naver.com')) {
    return null;
  }

  try {
    const res = await axios.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    
    let content = $('#dic_area').text() || $('article').text() || $('#articeBody').text() || '';
    content = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!content) return null;

    const data: NaverScrapedData = { content };

    // --- A. Extract Official Image ---
    $('.end_photo_org, .nbd_im_w, .photo_center, .img_wrap').each((i, el) => {
      const imgSrc = $(el).find('img').attr('src');
      const caption = $(el).find('.img_desc, em').text().trim();
      
      if (imgSrc && caption) {
        // Look for official PR photo indicators
        if (/(제공|엔터테인먼트|소속사|사진=)/.test(caption)) {
          data.officialImageUrl = imgSrc;
          return false; // Break loop, found the official one
        }
      }
    });

    // If no explicit caption matched, fallback to the very first image for entertain.naver.com (usually the main article photo)
    if (!data.officialImageUrl) {
        const firstImg = $('.end_photo_org img, .nbd_im_w img, .photo_center img').first().attr('src');
        if (firstImg) data.officialImageUrl = firstImg;
    }

    // --- B. Extract Release Date ---
    // Matches patterns like "8월 2일", "10월 24일"
    const exactDateMatch = content.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (exactDateMatch) {
      const month = exactDateMatch[1].padStart(2, '0');
      const day = exactDateMatch[2].padStart(2, '0');
      // Assume current year (2026 for now, or Date.getFullYear())
      const year = new Date().getFullYear();
      data.releaseDate = `${year}-${month}-${day}`;
    } else {
      const monthMatch = content.match(/(\d{1,2})월/);
      if (monthMatch) {
        const month = monthMatch[1].padStart(2, '0');
        const year = new Date().getFullYear();
        data.releaseDate = `${year}-${month}-TBA`;
      } else if (content.includes("하반기")) {
        data.releaseDate = `${new Date().getFullYear()}-H2-TBA`;
      } else if (content.includes("상반기")) {
        data.releaseDate = `${new Date().getFullYear()}-H1-TBA`;
      } else if (content.includes("내달") || content.includes("다음달")) {
        data.releaseDate = `NextMonth-TBA`;
      }
    }

    // --- C. Extract Release Type ---
    if (content.includes("정규")) data.releaseType = "full";
    else if (content.includes("미니")) data.releaseType = "mini";
    else if (content.includes("싱글")) data.releaseType = "single";

    // --- D. Extract Artist Type ---
    if (content.includes("솔로 데뷔") || content.includes("솔로 컴백") || content.includes("솔로 앨범") || content.match(/가수\s+[가-힣A-Za-z0-9]+/)) {
      data.artistType = "solo";
    } else if (content.includes("유닛 데뷔") || content.includes("유닛 컴백") || content.includes("유닛 앨범")) {
      data.artistType = "unit";
    } else if (content.includes("밴드")) {
      data.artistType = "band"; // Storing band separately if helpful, but will map to group
    } else if (content.includes("걸그룹") || content.includes("보이그룹") || content.includes("그룹")) {
      data.artistType = "group";
    }

    return data;
  } catch (e: any) {
    logger.error(`Naver News scraping error (${url}): ${e.message}`);
    return null;
  }
}
