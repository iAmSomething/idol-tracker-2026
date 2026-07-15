import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { Innertube } from 'youtubei.js';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function isTeaser(title: string) {
  const lower = title.toLowerCase();
  return lower.includes('teaser') || lower.includes('티저') || 
         lower.includes('trailer') || lower.includes('트레일러') || 
         lower.includes('highlight medley') || lower.includes('하이라이트 메들리');
}

function isMV(title: string) {
  const lower = title.toLowerCase();
  return lower.includes('m/v') || lower.includes(' mv ') || lower.endsWith(' mv') ||
         lower.includes('뮤직비디오') || lower.includes('official video');
}

async function run() {
  const yt = await Innertube.create();
  
  console.log("Fetching artists from Firestore...");
  const snapshot = await getDocs(collection(db, 'artists'));
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log("Fetching all comebacks to optimize queries...");
  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  const allComebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));
  
  const comebacksByArtist = new Map<string, any[]>();
  for (const cb of allComebacks) {
    if (!comebacksByArtist.has(cb.artistId)) {
      comebacksByArtist.set(cb.artistId, []);
    }
    comebacksByArtist.get(cb.artistId)!.push(cb);
  }
  
  let processed = 0;
  
  for (const artist of artists) {
    const ytUrl = artist.socialLinks?.youtube;
    if (!ytUrl) continue;
    
    // Fast check: does this artist even have a pending or teasing comeback?
    const artistComebacks = comebacksByArtist.get(artist.id) || [];
    
    // Filter active comebacks (not released yet, or newly released)
    const activeComebacks = artistComebacks.filter(data => {
      return data.status !== 'RELEASED'; // only process ANNOUNCED or TEASING (or undefined if newly created by our community scraper)
    });
    
    if (activeComebacks.length === 0) {
      continue;
    }

    console.log(`\n[${++processed}] Checking ${artist.name} videos... (${activeComebacks.length} active comebacks)`);
    
    try {
      const urlInfo = await yt.resolveURL(ytUrl);
      const channelId = urlInfo.payload.browseId;
      if (!channelId) continue;
      
      const chan = await yt.getChannel(channelId);
      const videos = await chan.getVideos(); // fetches recent videos
      
      if (!videos.videos || videos.videos.length === 0) continue;
      
      // Look at the latest 10 videos
      for (const video of videos.videos.slice(0, 10) as any[]) {
        const title = video.title?.text || '';
        const videoId = video.id;
        const videoUrl = `https://youtube.com/watch?v=${videoId}`;
        
        if (isTeaser(title)) {
          for (const cbData of activeComebacks) {
            const teasers = cbData.teasers || [];
            
            if (!teasers.includes(videoUrl)) {
              console.log(`  🎥 Found Teaser: ${title}`);
              await updateDoc(doc(db, 'comebacks', cbData.docId), {
                teasers: arrayUnion(videoUrl),
                status: 'TEASING'
              });
              console.log(`     -> Updated status to TEASING and added teaser URL`);
            }
          }
        } else if (isMV(title)) {
          for (const cbData of activeComebacks) {
            // Cross-validation: video title MUST contain the album title or one of the track names
            const tracksSnap = await getDocs(query(collection(db, 'tracks'), where('comebackId', '==', cbData.docId)));
            const trackNames = tracksSnap.docs.map(d => (d.data().name || '').toLowerCase());
            const albumTitleLower = (cbData.albumTitle || cbData.title || '').toLowerCase();
            const videoTitleLower = title.toLowerCase();
            
            let isValid = false;
            if (albumTitleLower && videoTitleLower.includes(albumTitleLower)) isValid = true;
            if (trackNames.some(name => name && videoTitleLower.includes(name))) isValid = true;
            
            if (!isValid) {
              console.log(`  🎵 Found MV pattern, but cross-validation failed (no match for album/tracks): ${title}`);
              continue;
            }

            // Assuming the first track is the title track
            const titleTracks = cbData.titleTracks || [{ name: cbData.title || 'Title' }];
            if (!titleTracks[0].musicVideoUrl || titleTracks[0].musicVideoUrl !== videoUrl) {
              console.log(`  🎵 Found Valid MV: ${title}`);
              titleTracks[0].musicVideoUrl = videoUrl;
              await updateDoc(doc(db, 'comebacks', cbData.docId), {
                titleTracks: titleTracks,
                status: 'RELEASED'
              });
              console.log(`     -> Updated status to RELEASED and added MV URL`);
            }
          }
        }
      }
      
    } catch (err: any) {
      console.log(`  ❌ Error processing ${artist.name}: ${err.message}`);
    }
  }
  
  console.log("\nFinished processing all YouTube videos!");
  process.exit(0);
}

run();
