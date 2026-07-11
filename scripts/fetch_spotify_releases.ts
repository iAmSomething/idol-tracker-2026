import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env");
  process.exit(1);
}

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
});

async function run() {
  console.log("Authenticating with Spotify...");
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log("Spotify Authentication successful.");
  } catch (err) {
    console.error("Spotify Authentication failed:", err);
    process.exit(1);
  }

  console.log("Fetching pending comebacks from Firestore...");
  // We want to check comebacks that are not RELEASED yet
  const comebacksRef = collection(db, 'comebacks');
  const snapshot = await getDocs(query(comebacksRef, where('status', 'in', ['ANNOUNCED', 'TEASING'])));
  
  if (snapshot.empty) {
    console.log("No pending comebacks found.");
    process.exit(0);
  }

  const today = new Date().toISOString().split('T')[0];
  let processed = 0;

  for (const comebackDoc of snapshot.docs) {
    const comeback = comebackDoc.data();
    
    // Only check if the comeback date has passed or is today
    if (comeback.date > today) {
      console.log(`[SKIP] ${comeback.artistName} - ${comeback.title} (Releasing in future: ${comeback.date})`);
      continue;
    }

    processed++;
    console.log(`\n🔍 Checking Spotify for ${comeback.artistName} - ${comeback.title}`);
    
    try {
      // Search Spotify for albums by this artist
      // Using a precise query
      const searchQuery = `artist:${comeback.artistName} album:${comeback.title}`;
      const res = await spotifyApi.searchAlbums(searchQuery, { limit: 5 });
      
      const albums = res.body.albums?.items || [];
      if (albums.length > 0) {
        // We found an album match!
        const album = albums[0];
        console.log(`  🎉 FOUND ON SPOTIFY! [${album.album_type}] ${album.name}`);
        console.log(`  🔗 Link: ${album.external_urls.spotify}`);

        const streamingLinks = comeback.streamingLinks || {};
        streamingLinks.spotify = album.external_urls.spotify;

        // Update Firestore
        await updateDoc(doc(db, 'comebacks', comebackDoc.id), {
          status: 'RELEASED',
          streamingLinks: streamingLinks
        });
        console.log(`  ✅ Updated DB status to RELEASED!`);
      } else {
        // Try searching tracks instead of albums, in case it's a single track
        const trackQuery = `artist:${comeback.artistName} track:${comeback.title}`;
        const trackRes = await spotifyApi.searchTracks(trackQuery, { limit: 5 });
        const tracks = trackRes.body.tracks?.items || [];
        
        if (tracks.length > 0) {
          const track = tracks[0];
          console.log(`  🎉 FOUND TRACK ON SPOTIFY! ${track.name}`);
          console.log(`  🔗 Link: ${track.external_urls.spotify}`);

          const streamingLinks = comeback.streamingLinks || {};
          streamingLinks.spotify = track.external_urls.spotify;

          await updateDoc(doc(db, 'comebacks', comebackDoc.id), {
            status: 'RELEASED',
            streamingLinks: streamingLinks
          });
          console.log(`  ✅ Updated DB status to RELEASED!`);
        } else {
          console.log(`  ❌ Not found on Spotify yet.`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error searching Spotify for ${comeback.artistName}:`, err);
    }
  }
  
  console.log(`\nFinished Spotify verification (checked ${processed} comebacks).`);
  process.exit(0);
}

run();
