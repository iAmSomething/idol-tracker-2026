import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { Innertube } from 'youtubei.js';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log("🚀 Starting YouTube Community Augmentation Pipeline (AI-Free)...");
  
  // 1. Initialize Innertube
  const yt = await Innertube.create();

  // 2. Fetch comebacks from Firestore
  const comebacksRef = collection(db, 'comebacks');
  const comebacksSnap = await getDocs(comebacksRef);
  const now = new Date();
  
  const imminent = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
    .filter(c => {
      if (!c.releaseDate) return false;
      const parts = c.releaseDate.split('-');
      if (parts.length !== 3) return false;
      const cbDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const diffTime = cbDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Look at comebacks up to 60 days in future to capture all upcoming comebacks
      return diffDays >= -2 && diffDays <= 60;
    });
  
  console.log(`Found ${imminent.length} imminent/upcoming comebacks to process.`);

  // 3. Fetch artists
  const artistsRef = collection(db, 'artists');
  const artistsSnap = await getDocs(artistsRef);
  const artists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  for (const cb of imminent) {
    console.log(`\n🔍 Augmenting data for: ${cb.artistName} (Date: ${cb.releaseDate})`);
    
    // Find artist
    const artist = artists.find(a => {
      const ko = typeof a.name === 'object' ? (a.name.ko || '') : (typeof a.name === 'string' ? a.name : '');
      const en = typeof a.name === 'object' ? (a.name.en || '') : '';
      const aliases = typeof a.name === 'object' ? (a.name.aliases || []) : [];
      
      const sKo = ko.toLowerCase().replace(/\s+/g, '');
      const sEn = en.toLowerCase().replace(/\s+/g, '');
      const search = cb.artistName.toLowerCase().replace(/\s+/g, '');
      
      return sKo === search || sEn === search || sKo.includes(search) || sEn.includes(search) ||
             aliases.some((alias: string) => alias.toLowerCase().replace(/\s+/g, '') === search);
    });

    if (!artist || !artist.socialLinks?.youtube) {
      console.log(`   -> ⚠️ No YouTube channel found in DB for ${cb.artistName}. Skipping.`);
      continue;
    }

    const channelUrl = artist.socialLinks.youtube;
    console.log(`   -> Found YouTube channel: ${channelUrl}`);
    
    try {
      const urlInfo = await yt.resolveURL(channelUrl);
      const channelId = urlInfo.payload.browseId;
      if (!channelId) {
        console.log(`   -> Could not resolve channel ID for URL: ${channelUrl}`);
        continue;
      }
      
      const chan = await yt.getChannel(channelId);
      const community = await chan.getCommunity();
      
      let posts = [...(community.posts || [])];
      if (community.has_continuation) {
        console.log("   -> Fetching page 2 of community posts...");
        const nextPage = await community.getContinuation();
        if (nextPage.posts) {
          posts.push(...nextPage.posts);
        }
      }
      
      if (posts.length === 0) {
        console.log(`   -> No community posts found.`);
        continue;
      }

      console.log(`   -> Retrieved ${posts.length} community posts for analysis.`);

      let updated = false;
      const updatePayload: any = { updatedAt: new Date().toISOString() };
      
      // Clean up legacy fields: rename "title" to "albumTitle" if "title" exists but "albumTitle" does not
      if (cb.title && !cb.albumTitle) {
        updatePayload.albumTitle = cb.title;
        updatePayload.title = deleteField();
        updated = true;
      }

      for (const post of posts) {
        const text = post.content?.text || '';
        const textLower = text.toLowerCase();
        
        // 1. Detect and parse Tracklist
        if (/track\s*list|tracklist|수록곡|트랙\s*리스트/i.test(text)) {
          console.log(`   🌟 Tracklist post found! Parsing...`);
          const lines = text.split('\n');
          const parsedTracks: { name: string, isTitle: boolean }[] = [];
          
          for (const line of lines) {
            const match = line.match(/^\s*(\d+)\.\s*(.+)$/);
            if (match) {
              let trackName = match[2].trim();
              let isTitle = false;
              if (/\((title|타이틀|타이틀곡)\)/i.test(trackName)) {
                isTitle = true;
                trackName = trackName.replace(/\((title|타이틀|타이틀곡)\)/i, '').trim();
              }
              parsedTracks.push({ name: trackName, isTitle });
            }
          }
          
          if (parsedTracks.length > 0) {
            console.log(`   👉 Parsed ${parsedTracks.length} tracks! Saving to Firestore...`);
            
            // Set tracks in 'tracks' collection
            for (let idx = 0; idx < parsedTracks.length; idx++) {
              const tr = parsedTracks[idx];
              const trackId = `${cb.id}-track-${idx}`;
              await setDoc(doc(db, 'tracks', trackId), {
                id: trackId,
                comebackId: cb.id,
                artistId: cb.artistId || artist.id,
                name: tr.name,
                isTitle: tr.isTitle,
                duration: null,
                musicVideoUrl: null,
                streamingLinks: {}
              });
            }
            
            // Update titleTracks in comeback
            const titleTrack = parsedTracks.find(t => t.isTitle) || parsedTracks[0];
            updatePayload.titleTracks = [{ name: titleTrack.name }];
            updated = true;
          }
        }

        // 2. Extract Album Title
        if (!cb.albumTitle && !updatePayload.albumTitle) {
          const albumRegex = /(?:album|ep|single|집|신보|싱글|미니)\s*([\[\('‘"“])([^\]\)'’”"”]+)([\]\)'’”"”])/i;
          const albumMatch = text.match(albumRegex);
          if (albumMatch) {
            updatePayload.albumTitle = albumMatch[2].trim();
            console.log(`   ✅ Extracted Album Title: "${updatePayload.albumTitle}"`);
            updated = true;
          }
        }

        // 3. Extract high-res concept image
        const isConcept = textLower.includes('concept') || textLower.includes('콘셉트') || textLower.includes('photo') || textLower.includes('#fruit') || textLower.includes('teaser');
        if (isConcept && (!cb.albumCoverUrl || cb.albumCoverUrl.includes('imgnews.pstatic.net')) && !updatePayload.albumCoverUrl) {
          let imageUrl = null;
          if (post.attachment?.type === 'Image' && Array.isArray(post.attachment.image)) {
            imageUrl = post.attachment.image[post.attachment.image.length - 1]?.url;
          } else if (post.attachment?.type === 'PostMultiImage' && Array.isArray(post.attachment.images)) {
            const firstImg = post.attachment.images[0];
            if (firstImg && Array.isArray(firstImg.image)) {
              imageUrl = firstImg.image[firstImg.image.length - 1]?.url;
            }
          }
          if (imageUrl) {
            updatePayload.albumCoverUrl = imageUrl;
            console.log(`   ✅ Extracted High-Res Concept Image!`);
            updated = true;
          }
        }

        // 4. Extract teaser / music video
        const isTeaser = textLower.includes('teaser') || textLower.includes('티저') || textLower.includes('mv');
        if (isTeaser && !cb.mediaLinks?.musicVideo && !updatePayload["mediaLinks.musicVideo"]) {
          let videoUrl = null;
          if (post.attachment?.type === 'Video' && post.attachment.video_id) {
            videoUrl = `https://www.youtube.com/watch?v=${post.attachment.video_id}`;
          }
          if (videoUrl) {
            updatePayload["mediaLinks.musicVideo"] = videoUrl;
            console.log(`   ✅ Extracted Teaser Video URL: ${videoUrl}`);
            updated = true;
          }
        }
      }

      if (updated) {
        await updateDoc(doc(db, 'comebacks', cb.id), updatePayload);
        console.log(`   🎉 Successfully updated comeback document!`);
      } else {
        console.log(`   -> No new details to update.`);
      }

    } catch (err) {
      console.error(`   ❌ Error resolving YouTube posts:`, err);
    }
    
    await sleep(2000); // Politeness delay
  }

  console.log("\nFinished Intensive Augmentation Pipeline (AI-Free)!");
  process.exit(0);
}

run().catch(console.error);
