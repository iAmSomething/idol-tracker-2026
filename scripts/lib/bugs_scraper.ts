import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger';

export interface BugsNewAlbum {
  albumId: string;
  title: string;
  artistName: string;
  artistId: string;
  releaseType: string;
  releaseDate: string;
  coverUrl: string;
}

/**
 * Scrape the latest domestic albums from Bugs.
 * @returns Array of new albums
 */
export async function scrapeBugsLatestAlbums(): Promise<BugsNewAlbum[]> {
  const albums: BugsNewAlbum[] = [];
  try {
    const res = await axios.get('https://music.bugs.co.kr/genre/kpop/idol/total?tabtype=3', { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(res.data);
    
    $('figure.albumInfo').each((i, el) => {
      const albumId = $(el).attr('albumid') || '';
      const artistId = $(el).attr('artistid') || '';
      
      const title = $(el).find('.albumTitle a').text().trim();
      // Handle multiple artists or single artist
      const artistName = $(el).find('.artist a').first().text().trim() || $(el).find('.artistTitle').first().text().trim();
      
      const releaseTypeRaw = $(el).find('.albumType').text().trim();
      let releaseType = "unknown";
      if (releaseTypeRaw.includes('정규')) releaseType = "full";
      else if (releaseTypeRaw.includes('미니')) releaseType = "mini";
      else if (releaseTypeRaw.includes('싱글') || releaseTypeRaw.includes('스페셜')) releaseType = "single";

      const releaseDateRaw = $(el).find('time').text().trim();
      let releaseDate = releaseDateRaw;
      if (releaseDateRaw.includes('.')) {
        // "2026.07.14" -> "2026-07-14"
        releaseDate = releaseDateRaw.replace(/\./g, '-');
      }

      const coverUrl = $(el).find('.thumbnail img').attr('src') || '';

      const upperTitle = title.toUpperCase();
      if (upperTitle.includes('OST') || upperTitle.includes('SOUNDTRACK') || upperTitle.includes('ORIGINAL SOUNDTRACK')) {
        return;
      }

      if (title && artistName && releaseDate) {
        albums.push({
          albumId,
          title,
          artistName,
          artistId,
          releaseType,
          releaseDate,
          coverUrl
        });
      }
    });

    return albums;
  } catch (error: any) {
    logger.error("Failed to scrape bugs latest albums:", error.message);
    return [];
  }
}

export async function fetchBugsArtistValidation(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    const detailUrl = $search('figure.artistInfo a.thumbnail').first().attr('href');
    if (!detailUrl) return null;

    const detailRes = await axios.get(detailUrl, { timeout: 5000 });
    const $detail = cheerio.load(detailRes.data);
    const artistTypeStr = $detail('table.info tbody tr').text().replace(/\s+/g, ' ');
    const actualName = $detail('header.sectionPadding h1').text().trim();
    
    const isSubstring = actualName.includes(artistName) || artistName.includes(actualName);
    if (!isSubstring) {
      const isGroup = artistTypeStr.includes('그룹');
      const debutYearMatch = artistTypeStr.match(/데뷔 (\d{4})/);
      const debutYear = debutYearMatch ? parseInt(debutYearMatch[1], 10) : 0;
      
      if (!isGroup && debutYear < 2020) {
        return null;
      }
    }

    if (artistTypeStr.includes('배우') || artistTypeStr.includes('개그맨') || artistTypeStr.includes('방송인')) {
      return null;
    }

    let gender: "male" | "female" | "mixed" | undefined;
    if (artistTypeStr.includes('(여성)')) gender = 'female';
    else if (artistTypeStr.includes('(남성)')) gender = 'male';
    else if (artistTypeStr.includes('(혼성)')) gender = 'mixed';
    
    let type: "group" | "solo" | "unit" = artistTypeStr.includes('그룹') ? 'group' : 'solo';

    return { gender, type };
  } catch (e: any) {
    logger.error(`Error validating ${artistName} on Bugs: ${e.message}`);
    return null;
  }
}
