import * as path from "path";
import * as dotenv from "dotenv";
import { db } from "./lib/firebase-helpers";
import { logger } from "./lib/logger";
import { fetchYouTubeCommunityInfo } from "./lib/youtube_scraper";
import { searchNaverNews, scrapeNaverNewsContent } from "./lib/naver_news_scraper";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, query, where } from "firebase/firestore";
import { scrapeBugsLatestAlbums, fetchBugsArtistValidation, scrapeBugsSearch, BugsAlbumData } from "./lib/bugs_scraper";
import { fetchAllStreamingLinks } from "./lib/streaming_links_scraper";
import axios from "axios";
import * as cheerio from "cheerio";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function verifyBugsAlbum(artistName: string, expectedReleaseDate: string) {
  try {
    const query = artistName;
    const url = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { timeout: 5000 });
    const $ = cheerio.load(res.data);
    
    let foundAlbum = null;
    $("div#albumList table.list.albumList tbody tr").slice(0, 3).each((i, el) => {
      const rowArtist = $(el).find("p.artist a").text().trim();
      if (rowArtist.includes(artistName) || artistName.includes(rowArtist)) {
        foundAlbum = {
          albumId: $(el).attr("albumid"),
          title: $(el).find("p.title a").text().trim(),
          coverUrl: $(el).find("a.thumbnail img").attr("src"),
          releaseDateStr: $(el).find("time").text().trim() 
        };
        return false; 
      }
    });

    return foundAlbum;
  } catch (e) {
    logger.error(`Bugs album search error for ${artistName}:`, e);
    return null;
  }
}

async function runDailyCrawler() {
  logger.info("Starting Daily Precision Crawler with Naver News API...");
  
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const pastWeek = new Date();
  pastWeek.setDate(today.getDate() - 7);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  const pastWeekStr = pastWeek.toISOString().split('T')[0];

  const comebacksSnap = await getDocs(collection(db, 'comebacks'));

  const artistsSnap = await getDocs(collection(db, 'artists'));
  const artistYoutubeMap = new Map<string, string>();
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const name = typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
    const ytUrl = data.socialLinks?.youtube || data.agency?.youtubeUrl;
    if (ytUrl) artistYoutubeMap.set(name, ytUrl);
  });
  
  for (const cDoc of comebacksSnap.docs) {
    const data = cDoc.data();
    
    // 1. Check if released (Date has passed or is today)
    if (data.releaseDate !== "TBA" && data.releaseDate <= todayStr && !data.isReleased) {
      if (data.releaseDate < pastWeekStr) {
        logger.info(`❌ [STALE] Comeback for ${data.artistName} (${data.releaseDate}) is older than 1 week. Deleting to save API calls.`);
        await deleteDoc(doc(db, "comebacks", cDoc.id));
        continue;
      }

      logger.info(`[RELEASED] ${data.artistName} comeback date passed (${data.releaseDate}). Scraping final bugs data...`);
      
      const albumData = await verifyBugsAlbum(data.artistName, data.releaseDate);
      if (albumData) {
        logger.info(`✅ Found real album for ${data.artistName}: ${albumData.title}`);
        await updateDoc(doc(db, "comebacks", cDoc.id), {
          isReleased: true,
          streamingLinks: await fetchAllStreamingLinks(data.artistName, albumData.title, `https://music.bugs.co.kr/album/${albumData.albumId}`, data.releaseType),
          title: albumData.title,
          albumCoverUrl: albumData.coverUrl || "",
          bugsAlbumId: albumData.albumId || ""
        });

        // NEW: Fetch track-level streaming links safely with jitter delay
        const tracksQuery = query(collection(db, "tracks"), where("comebackId", "==", cDoc.id));
        const tracksSnap = await getDocs(tracksQuery);
        for (const tDoc of tracksSnap.docs) {
          const tData = tDoc.data();
          if (!tData.name || tData.name === "TBA") continue;
          
          logger.info(`Fetching links for Track: [${data.artistName}] ${tData.name}...`);
          const existingBugs = tData.streamingLinks?.bugs;
          
          // Using fetchAllStreamingLinksForTrack dynamically (imported from streaming_links_scraper)
          const scraper = require("./lib/streaming_links_scraper");
          if (scraper.fetchAllStreamingLinksForTrack) {
            const newLinks = await scraper.fetchAllStreamingLinksForTrack(data.artistName, tData.name, existingBugs);
            if (Object.keys(newLinks).length > 0) {
              await updateDoc(doc(db, "tracks", tDoc.id), { streamingLinks: newLinks });
              logger.info(`✅ Updated track links for ${tData.name}`);
            }
            // Delay 2-4 seconds
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
          }
        }
      } else {
        logger.info(`❌ Album not found for ${data.artistName}. Deleting fake/cancelled comeback.`);
        await deleteDoc(doc(db, "comebacks", cDoc.id));
      }
      
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const needsEnrichment = !data.isReleased && (
      data.title === "TBA" || !data.title || 
      data.releaseDate?.includes("TBA") || 
      !data.albumCoverUrl
    );
    const isApproaching = data.releaseDate >= todayStr && data.releaseDate <= nextWeekStr;

    if (needsEnrichment || isApproaching) {
      logger.info(`[ENRICH] Searching Naver News to enrich ${data.artistName}...`);
      
      const newsItems = await searchNaverNews(`"${data.artistName}" 컴백 OR 데뷔 OR 신곡`, 5);
      let enriched = false;
      let updates: Record<string, any> = {};

      for (const news of newsItems) {
        const scraped = await scrapeNaverNewsContent(news.link);
        if (!scraped) continue;

        if (!data.albumCoverUrl && !updates.albumCoverUrl && scraped.officialImageUrl) {
           updates.albumCoverUrl = scraped.officialImageUrl;
        }
        
        if (data.releaseDate?.includes("TBA") && scraped.releaseDate && !scraped.releaseDate.includes("TBA") && !updates.releaseDate) {
           updates.releaseDate = scraped.releaseDate;
        }

        if (data.releaseType === "unknown" && scraped.releaseType && !updates.releaseType) {
           updates.releaseType = scraped.releaseType;
        }

        if (scraped.summary && !data.aiSummary) {
           updates.aiSummary = scraped.summary;
        }

        if (Object.keys(updates).length > 0) {
          enriched = true;
          // Gather top 3 recent news for display
          if (isApproaching) {
            updates.recentNews = newsItems.slice(0, 3).map(n => ({ title: n.title, link: n.link, pubDate: n.pubDate }));
            updates.lastTeaserUpdate = new Date().toISOString();
          }
          break; // Found the missing pieces, stop parsing more articles
        }
      }

      if (Object.keys(updates).length > 0) {
        logger.info(`[✅ NAVER ENRICH] Updated ${data.artistName}: ${JSON.stringify(updates)}`);
        await updateDoc(doc(db, "comebacks", cDoc.id), updates);
      }

      // 2. YouTube Community Fallback (If Naver failed to find missing date/title)
      if (needsEnrichment && (!enriched || data.releaseDate?.includes("TBA") || data.title === "TBA")) {
         logger.info(`[📺 YT ENRICH] Naver didn't have full info, falling back to YouTube Community for ${data.artistName}...`);
         const officialYtUrl = artistYoutubeMap.get(data.artistName);
         const ytInfo = await fetchYouTubeCommunityInfo(data.artistName, officialYtUrl);
         
         if (ytInfo) {
           const ytUpdates: Record<string, any> = {};
           if (ytInfo.title && (!data.title || data.title === "TBA")) ytUpdates.title = ytInfo.title;
           if (ytInfo.releaseDate && (!data.releaseDate || data.releaseDate.includes("TBA") || updates.releaseDate?.includes("TBA"))) ytUpdates.releaseDate = ytInfo.releaseDate;
           if (ytInfo.releaseType && (!data.releaseType || data.releaseType === "unknown")) ytUpdates.releaseType = ytInfo.releaseType;
           if (ytInfo.albumCoverUrl && (!data.albumCoverUrl || !updates.albumCoverUrl)) ytUpdates.albumCoverUrl = ytInfo.albumCoverUrl;
           
           if (Object.keys(ytUpdates).length > 0) {
             logger.info(`[📺 YT ENRICH] Updated ${data.artistName}: ${JSON.stringify(ytUpdates)}`);
             await updateDoc(doc(db, "comebacks", cDoc.id), ytUpdates);
           }
         }
      }

      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // --- BUGS SAFETY NET ---
  logger.info("Starting Bugs Safety Net to catch missed comebacks...");
  
  // Cache artists
  const allArtists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const latestAlbums = await scrapeBugsLatestAlbums();
  logger.info(`Found ${latestAlbums.length} latest domestic albums on Bugs.`);
  
  const justAddedComebacks = new Set<string>();
  let newlyCaught = 0;
  for (const album of latestAlbums) {
    if (!album.artistName || !album.releaseDate) continue;

    // Filter out very old things just in case, but they should be today or yesterday
    if (album.releaseDate < pastWeekStr) continue;

    // Check if artist already has a comeback within 14 days (+/- 14 days)
    const albumDateObj = new Date(album.releaseDate);
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    
    let hasRecentComeback = false;
    const comebacksRef = collection(db, "comebacks");
    const artistQuery = query(comebacksRef, where("artistName", "==", album.artistName));
    const artistComebacksSnap = await getDocs(artistQuery);

    for (const cDoc of artistComebacksSnap.docs) {
      const data = cDoc.data();
      if (data.releaseDate !== "TBA") {
        const cDateObj = new Date(data.releaseDate);
        const diff = Math.abs(albumDateObj.getTime() - cDateObj.getTime());
        if (diff <= fourteenDaysMs) {
           hasRecentComeback = true;
           break;
        }
      }
    }

    if (hasRecentComeback) {
       // It's likely a compilation/remix/version of an existing comeback.
       continue;
    }

    // It's not in DB. Let's check if it's an idol
    const bugsInfo = await fetchBugsArtistValidation(album.artistName);
    if (bugsInfo) {
       // Double check with Qwen to filter out non-idols that sneak into Bugs idol genre
       const qwenInfo = await require("./lib/qwen_extractor").parseArticleWithQwen(
         `벅스 아이돌 장르 앨범 발매 정보. 아티스트: ${album.artistName}, 앨범명: ${album.title}`, 
         `${album.artistName} 앨범 발매`
       );
       
       if (qwenInfo && qwenInfo.isIdol === false) {
           logger.info(`🚨 [SAFETY NET] Skipping non-idol ${album.artistName} after Qwen check.`);
           // Push to comebacksSnap so we don't check this non-idol again in this run
           comebacksSnap.docs.push({ data: () => ({ artistName: album.artistName, releaseDate: album.releaseDate }) } as any);
           continue;
       }

       logger.info(`🚨 [SAFETY NET] Caught missed comeback! ${album.artistName} - ${album.title} (${album.releaseDate})`);
       
       // Lookup artist in artists collection
       const search = album.artistName.toLowerCase().replace(/\s+/g, '');

       const blocklist = ["sm", "jyp", "yg", "hybe", "bighit", "smtown", "cube", "starship", "fnc", "pledis", "sourcemusic", "ador", "beliftlab", "kakao", "cj", "mbk", "dsp", "wm", "woollim", "rbw", "pnation", "mystic", "fantagio", "antenna", "smentertainment", "jypentertainment", "ygentertainment", "bighitmusic"];
       if (blocklist.includes(search)) {
         logger.info(`🚨 [SAFETY NET] Skipping blocked name (Agency/Dummy): ${album.artistName}`);
         continue;
       }

       let artist = allArtists.find(a => {
         const ko = typeof a.name === 'object' ? (a.name.ko || '') : (typeof a.name === 'string' ? a.name : '');
         const en = typeof a.name === 'object' ? (a.name.en || '') : '';
         const aliases = typeof a.name === 'object' ? (a.name.aliases || []) : [];
         
         const sKo = ko.toLowerCase().replace(/\s+/g, '');
         const sEn = en.toLowerCase().replace(/\s+/g, '');
         
         return sKo === search || sEn === search || sKo.includes(search) || sEn.includes(search) ||
                aliases.some((alias: string) => alias.toLowerCase().replace(/\s+/g, '') === search);
       });

       let finalArtistId = "";
       let finalArtistGender = bugsInfo.gender || "mixed";
       let finalArtistType = bugsInfo.type || "unknown";
       let finalParentGroupName = "";
       let finalParentGroupId = "";

       if (!artist) {
         logger.info(`🚨 [SAFETY NET] Artist not found in DB! Creating NEW artist document for ${album.artistName}`);
         const newArtistRef = await addDoc(collection(db, "artists"), {
           name: { ko: album.artistName, en: "", aliases: [] },
           type: finalArtistType,
           gender: finalArtistGender,
           comebackIds: [],
           recentComebackDate: album.releaseDate,
           createdAt: new Date().toISOString()
         });
         finalArtistId = newArtistRef.id;
         // Add to allArtists cache so subsequent loop iterations find it
         allArtists.push({
           id: finalArtistId,
           name: { ko: album.artistName },
           type: finalArtistType,
           gender: finalArtistGender,
           comebackIds: [],
           recentComebackDate: album.releaseDate
         });
       } else {
         finalArtistId = artist.id;
         if (artist.gender) finalArtistGender = artist.gender;
         if (artist.type) finalArtistType = artist.type;
         if (artist.parentGroupName) finalParentGroupName = artist.parentGroupName;
         if (artist.parentGroupId) finalParentGroupId = artist.parentGroupId;
         
         const updateData: any = {};
         let needUpdate = false;
         if (!artist.recentComebackDate || album.releaseDate > artist.recentComebackDate) {
           updateData.recentComebackDate = album.releaseDate;
           updateData.recentComebackId = ""; // Will be updated later if needed
           needUpdate = true;
         }
         if (needUpdate) {
           await updateDoc(doc(db, "artists", finalArtistId), updateData);
         }
       }

       // Fetch agencyName from Bugs album page directly
       let agencyName = "Unknown";
       try {
         const cheerio = require("cheerio");
         const fetch = require("node-fetch");
         const res = await fetch(`https://music.bugs.co.kr/album/${album.albumId}`);
         const html = await res.text();
         const $ = cheerio.load(html);
         const agencyText = $("table.info tbody tr").filter((_, el) => $(el).find('th').text().trim() === '기획사').find('td').text().trim();
         if (agencyText) agencyName = agencyText;
       } catch(e) {
         // ignore
       }

       if (justAddedComebacks.has(`${finalArtistId}_${album.releaseDate}`)) {
          logger.info(`🚨 [SAFETY NET] Skipping duplicate comeback in same run: ${album.artistName} - ${album.releaseDate}`);
          continue;
       }

       // Add directly to comebacks because it's already released and verified
       const docData: any = {
         artistName: album.artistName,
         artistId: finalArtistId,
         artistGender: finalArtistGender,
         artistType: finalArtistType,
         agencyName: agencyName,
         title: album.title,
         albumTitle: album.title, // Support both title and albumTitle
         releaseDate: album.releaseDate,
         releaseType: album.releaseType,
         albumCoverUrl: album.coverUrl,
         bugsAlbumId: album.albumId,
         streamingLinks: await fetchAllStreamingLinks(album.artistName, album.title, `https://music.bugs.co.kr/album/${album.albumId}`, album.releaseType),
         isReleased: true,
         isMissedAndCaught: true, // Tag for internal tracking
         createdAt: new Date().toISOString()
       };
       if (finalParentGroupName) docData.parentGroupName = finalParentGroupName;
       if (finalParentGroupId) docData.parentGroupId = finalParentGroupId;

       const newCbRef = await addDoc(collection(db, "comebacks"), docData);
       justAddedComebacks.add(`${finalArtistId}_${album.releaseDate}`);
       
       // Update artist with comeback ID
       await updateDoc(doc(db, "artists", finalArtistId), {
         recentComebackId: newCbRef.id
       });

       newlyCaught++;
       
       // Just so we don't catch multiple variations of THIS newly caught one in the same loop
       comebacksSnap.docs.push({ data: () => ({ artistName: album.artistName, releaseDate: album.releaseDate }) } as any);
       
       await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (newlyCaught > 0) logger.info(`[SAFETY NET] Successfully recovered ${newlyCaught} missed comebacks.`);
  // --- END BUGS SAFETY NET ---

  logger.info("Daily Precision Crawl complete.");
  process.exit(0);
}

runDailyCrawler().catch(e => {
  logger.error("Daily Crawler Critical Failure:", e);
  process.exit(1);
});
