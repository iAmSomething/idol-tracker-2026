import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { fetchAllStreamingLinks } from './lib/streaming_links_scraper';
import { Innertube } from 'youtubei.js';
import { logger } from './lib/logger';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc5147da03ef769e59",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function isMV(title: string) {
  const lower = title.toLowerCase();
  return lower.includes('m/v') || lower.includes(' mv ') || lower.endsWith(' mv') ||
         lower.includes('뮤직비디오') || lower.includes('official video');
}

async function run() {
  logger.info("Starting targeted backfill for July 13th...");
  const yt = await Innertube.create();
  
  const artistsSnap = await getDocs(collection(db, 'artists'));
  const artistsMap = new Map(artistsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() as any }]));

  const comebacksRef = collection(db, "comebacks");
  const q = query(comebacksRef, where("releaseDate", "==", "2026-07-13"));
  const snap = await getDocs(q);

  for (const cDoc of snap.docs) {
    const data = cDoc.data();
    logger.info(`Checking comeback: ${data.artistName} - ${data.title || data.albumTitle}`);
    
    let needsUpdate = false;
    let updateData: any = {};

    // 1. Check Streaming Links
    const existingLinks = data.streamingLinks || {};
    if (!existingLinks.melon || !existingLinks.youtubeMusic || !existingLinks.appleMusic) {
      logger.info(`Fetching missing streaming links...`);
      const bugsLink = data.bugsAlbumId ? `https://music.bugs.co.kr/album/${data.bugsAlbumId}` : existingLinks.bugs;
      const albumTitleToSearch = data.albumTitle || data.title;
      
      const newLinks = await fetchAllStreamingLinks(data.artistName, albumTitleToSearch, bugsLink);
      if (Object.keys(newLinks).length > 0) {
        updateData.streamingLinks = { ...existingLinks, ...newLinks };
        needsUpdate = true;
      }
    }

    // 2. Fetch tracks and populate titleTracks if undefined
    let currentTitleTracks = data.titleTracks;
    if (!currentTitleTracks || currentTitleTracks.length === 0) {
      logger.info(`Fetching tracks from collection for ${data.artistName}...`);
      const tracksSnap = await getDocs(query(collection(db, "tracks"), where("comebackId", "==", cDoc.id)));
      const titles = tracksSnap.docs.map(d => d.data()).filter(t => t.isTitle);
      if (titles.length > 0) {
        currentTitleTracks = titles.map(t => ({ name: t.name, musicVideoUrl: "" }));
        updateData.titleTracks = currentTitleTracks;
        needsUpdate = true;
      }
    }

    // 3. Check MV
    const hasMV = currentTitleTracks?.some((t: any) => t.musicVideoUrl);
    if (!hasMV && currentTitleTracks && currentTitleTracks.length > 0) {
      const artist = artistsMap.get(data.artistId);
      const ytUrl = artist?.socialLinks?.youtube;
      
      if (ytUrl) {
        logger.info(`Fetching YouTube channel: ${ytUrl}`);
        try {
          const urlInfo = await yt.resolveURL(ytUrl);
          const channelId = urlInfo.payload.browseId;
          if (channelId) {
            const channel = await yt.getChannel(channelId);
            if (channel) {
              const videos = await channel.getVideos();
              const recentVideos = videos.videos.slice(0, 10);
              let foundMvUrl = "";
              
              for (const v of recentVideos) {
                const title = v.title?.text || '';
                if (isMV(title)) {
                  // Cross validation
                  const albumTitle = data.albumTitle?.toLowerCase() || '';
                  const trackNames = currentTitleTracks.map((t: any) => t.name.toLowerCase());
                  const tLower = title.toLowerCase();
                  
                  const hasAlbumMatch = albumTitle && tLower.includes(albumTitle);
                  const hasTrackMatch = trackNames.some((tn: string) => tLower.includes(tn));
                  
                  if (hasAlbumMatch || hasTrackMatch) {
                    foundMvUrl = `https://youtube.com/watch?v=${v.id}`;
                    logger.info(`Found MV: ${foundMvUrl} (${title})`);
                    break;
                  }
                }
              }
              
              if (foundMvUrl) {
                const updatedTracks = [...currentTitleTracks];
                updatedTracks[0].musicVideoUrl = foundMvUrl;
                updateData.titleTracks = updatedTracks;
                needsUpdate = true;
              }
            }
          }
        } catch (e: any) {
          logger.warn(`YouTube search failed for ${data.artistName}: ${e.message}`);
        }
      }
    }

    if (needsUpdate) {
      await updateDoc(doc(db, "comebacks", cDoc.id), updateData);
      logger.info(`✅ Updated ${data.artistName} in Firestore`);
    } else {
      logger.info(`✨ No updates needed for ${data.artistName}`);
    }
  }

  logger.info("Backfill complete!");
  process.exit(0);
}

run().catch(e => {
  logger.error("Backfill failed:", e);
  process.exit(1);
});
