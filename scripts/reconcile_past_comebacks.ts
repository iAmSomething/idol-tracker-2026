import dotenv from 'dotenv';
dotenv.config();
import { db } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, writeBatch, addDoc } from 'firebase/firestore';
import * as cheerio from 'cheerio';
import ytSearch from 'yt-search';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getCleanText(str: string): string {
  return str.replace(/[^a-zA-Z0-9가-힣]/g, "").trim().toLowerCase();
}

async function searchBugsAlbum(queryStr: string, targetDateYmd: string): Promise<any | null> {
  const url = `https://m.bugs.co.kr/api/getSearchList?type=album&query=${encodeURIComponent(queryStr)}&page=1&size=30`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.list || !Array.isArray(data.list)) return null;

    // Find album with release date matching targetDateYmd (+/- 1 day to handle timezones/release delay)
    const targetVal = parseInt(targetDateYmd, 10);
    const matches = data.list.filter((album: any) => {
      const albumDate = album.release_ymd; // YYYYMMDD
      if (!albumDate) return false;
      const albumVal = parseInt(albumDate, 10);
      return Math.abs(albumVal - targetVal) <= 1;
    });

    if (matches.length > 0) {
      // Sort: prioritize albums matching the artist name
      return matches[0];
    }
  } catch (e) {
    logger.error(`Bugs search failed for query "${queryStr}":`, e);
  }
  return null;
}

async function scrapeAlbumTracks(albumId: string, comebackId: string, artistName: string, albumTitle: string) {
  const res = await fetch(`https://music.bugs.co.kr/album/${albumId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Bugs Album page HTTP ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const tracks: any[] = [];
  const titleTracks: any[] = [];
  
  $("table.list.trackList tbody tr[rowtype='track']").each((_, el) => {
    let title = $(el).find('p.title a').first().text().trim();
    if (!title) {
      title = $(el).find('p.title').text().trim();
    }
    
    const isTitle = $(el).find('span.albumTitle').text().includes('타이틀곡');
    const mvid = $(el).attr('mvid');
    const trackId = $(el).attr('trackid');
    
    if (title && trackId) {
      tracks.push({
        id: trackId,
        name: title,
        isTitle,
        comebackId,
        artistName,
        albumTitle,
        streamingLinks: {
          bugs: `https://music.bugs.co.kr/track/${trackId}`
        }
      });
      
      if (isTitle) {
        titleTracks.push({
          name: title,
          _mvid: mvid
        });
      }
    }
  });

  // Resolve YouTube music videos for title tracks
  for (const t of titleTracks) {
    const queryStr = `${artistName} ${t.name} MV official`;
    try {
      const r = await ytSearch(queryStr);
      if (r.videos.length > 0) {
        t.musicVideoUrl = r.videos[0].url;
      } else if (t._mvid && t._mvid !== '0') {
        t.musicVideoUrl = `https://music.bugs.co.kr/mv/${t._mvid}`;
      }
    } catch (e) {
      logger.error(`YouTube MV search failed for "${queryStr}":`, e);
    }
    delete t._mvid;
  }

  return { tracks, titleTracks };
}

async function reconcile() {
  logger.info("Starting Past Comebacks Reconciliation...");

  const todayStr = new Date().toISOString().split('T')[0];
  const snapshot = await getDocs(collection(db, "comebacks"));
  const comebacks = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

  // Find past comebacks that are incomplete
  const pastIncomplete = comebacks.filter(c => {
    const isPast = c.releaseDate && c.releaseDate <= todayStr;
    const isIncomplete = !c.albumTitle || 
                         c.albumTitle === "TBA" || 
                         c.albumTitle === c.artistName ||
                         !c.tracks || 
                         c.tracks.length === 0 || 
                         !c.albumCoverUrl || 
                         c.albumCoverUrl.includes("unsplash.com");
    return isPast && isIncomplete;
  });

  logger.info(`Found ${pastIncomplete.length} past incomplete comebacks to reconcile.`);

  for (const cb of pastIncomplete) {
    logger.info(`\n🔍 Reconciling: "${cb.albumTitle || cb.title || 'Untitled'}" by ${cb.artistName} (${cb.releaseDate})`);

    const targetDateYmd = cb.releaseDate.replace(/-/g, "");
    
    // Try multiple queries
    const queries = [
      `${cb.artistName} ${cb.albumTitle || cb.title || ""}`,
      `${cb.albumTitle || cb.title || ""}`,
      cb.artistName
    ].filter(q => q && q.trim().length > 0 && q !== "TBA");

    let bugsAlbum = null;
    for (const q of queries) {
      logger.info(`  🔍 Searching Bugs with query: "${q}"...`);
      bugsAlbum = await searchBugsAlbum(q, targetDateYmd);
      if (bugsAlbum) break;
    }

    if (bugsAlbum) {
      logger.info(`  👑 Found Bugs match: "${bugsAlbum.title}" (${bugsAlbum.album_id})`);
      
      const albumId = bugsAlbum.album_id.toString();
      const cleanTitle = bugsAlbum.title;
      
      try {
        // Scrape details
        const { tracks, titleTracks } = await scrapeAlbumTracks(albumId, cb.id, cb.artistName, cleanTitle);
        
        // Write tracks to Firestore
        const batch = writeBatch(db);
        for (const track of tracks) {
          const trackRef = doc(collection(db, "tracks"));
          batch.set(trackRef, {
            ...track,
            createdAt: new Date().toISOString()
          });
        }
        await batch.commit();
        logger.info(`  👉 Created ${tracks.length} track documents in Firestore.`);

        // Determine album cover URL
        let coverUrl = `https://image.bugsm.co.kr/album/images/500/${albumId.substring(0, 5)}/${albumId}.jpg`;
        if (bugsAlbum.image?.path) {
          coverUrl = `https://image.bugsm.co.kr/album/images/500${bugsAlbum.image.path}`;
        }

        // Map release type
        let releaseType = "싱글";
        const typeNm = bugsAlbum.album_tp_nm;
        if (typeNm === "EP(미니)" || typeNm === "EP" || typeNm === "미니") releaseType = "EP(미니)";
        else if (typeNm === "정규") releaseType = "정규";

        // Update comeback document
        await updateDoc(doc(db, "comebacks", cb.id), {
          albumTitle: cleanTitle,
          albumCoverUrl: coverUrl,
          releaseType,
          tracks,
          titleTracks,
          "streamingLinks.bugs": `https://music.bugs.co.kr/album/${albumId}`,
          isCompleted: true,
          updatedAt: new Date().toISOString()
        });

        logger.info("  ✅ Successfully resolved and updated comeback data.");

      } catch (err: any) {
        logger.error(`  ❌ Failed to parse details for Bugs album ${albumId}:`, err.message);
      }
    } else {
      // No album found on Bugs for this past date.
      // Wait: only delete if it's older than yesterday to allow a 24-48h buffer
      const releaseTime = new Date(cb.releaseDate).getTime();
      const limitTime = new Date(todayStr).getTime() - (24 * 60 * 60 * 1000); // 1 day ago buffer

      if (releaseTime <= limitTime) {
        logger.warn(`  ❌ No album found on Bugs after release buffer. Deleting false-alarm comeback from DB.`);
        await deleteDoc(doc(db, "comebacks", cb.id));
        logger.info("  🗑️ Deleted comeback document successfully.");
      } else {
        logger.info("  ⏳ Within release buffer period. Keeping for next reconciliation.");
      }
    }
    
    await sleep(800);
  }

  logger.info("\n🎉 Past comebacks reconciliation complete.");
  process.exit(0);
}

reconcile().catch(e => {
  logger.error("Reconciliation Critical Failure:", e);
  process.exit(1);
});
