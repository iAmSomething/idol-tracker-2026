import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as fs from "fs";
import * as path from "path";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com",
  messagingSenderId: "47996752520"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Read Bugs Comeback Data
const dataPath = path.resolve(__dirname, "../bugs_comeback_data.json");
if (!fs.existsSync(dataPath)) {
  console.error("❌ bugs_comeback_data.json not found! Run the python crawler first.");
  process.exit(1);
}

const rawAlbums = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

async function seedComebacks() {
  console.log(`🚀 Found ${rawAlbums.length} albums from Bugs. Starting enrichment & upload...`);
  
  // Cache artists to memory for fast lookup
  const artistsSnapshot = await getDocs(collection(db, "artists"));
  const artistsMap = new Map<string, {id: string, name: string, type: string, aliases: string[], recentComebackDate: string, comebackIds: string[]}>();
  
  artistsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const meta = {
      id: doc.id,
      name: data.name.ko,
      type: data.type || "unknown",
      aliases: (data.name.aliases || []).map((a: string) => a.toLowerCase()),
      recentComebackDate: data.recentComeback || "0000-00-00",
      comebackIds: data.comebackIds || []
    };
    artistsMap.set(data.name.ko.toLowerCase(), meta);
    if (data.name.en) {
      artistsMap.set(data.name.en.toLowerCase(), meta);
    }
  });

  let batch = writeBatch(db);
  let count = 0;
  
  // To keep track of artist updates
  const artistUpdates = new Map<string, { recentComebackDate: string, recentComebackId: string, comebackIds: Set<string> }>();

  for (const album of rawAlbums) {
    const searchName = album.artistName.toLowerCase();
    let artistId = null;
    let finalArtistName = album.artistName;
    
    // Find artist matching
    for (const [key, artistMeta] of artistsMap.entries()) {
      if (searchName.includes(key) || key.includes(searchName) || artistMeta.aliases.some(a => searchName.includes(a))) {
        artistId = artistMeta.id;
        finalArtistName = artistMeta.name;
        break;
      }
    }
    
    if (!artistId) {
      artistId = `UNKNOWN_${album.artistName.replace(/[\s\/]+/g, '_')}`;
    }

    const comebackRef = doc(collection(db, "comebacks"));
    const comebackId = comebackRef.id;
    
    // Parse tracks
    const tracks = (album.tracks || []).map((t: any) => ({
      title: t.title,
      isTitle: t.isTitle,
      streamingLinks: t.streamingLinks || {}
    }));
    
    // Find title track
    const titleTrack = tracks.find((t: any) => t.isTitle) || tracks[0];
    
    let musicVideoUrl = album.musicVideoUrl;
    if (!musicVideoUrl && titleTrack) {
        const query = encodeURIComponent(`${finalArtistName} ${titleTrack.title} MV`);
        musicVideoUrl = `https://www.youtube.com/results?search_query=${query}`;
    }

    const releaseDate = album.releaseDate; // YYYY-MM-DD
    
    const comebackData = {
      artistId: artistId,
      artistName: finalArtistName,
      artistType: !artistId.startsWith("UNKNOWN_") ? artistsMap.get(finalArtistName.toLowerCase())?.type || "unknown" : "unknown",
      agencyName: album.agency || "미상",
      title: album.title,
      releaseDate: releaseDate, 
      releaseType: album.releaseType || "ep",
      isCompleted: true, 
      albumCoverUrl: album.imageUrl || "",
      tracks: tracks,
      streamingLinks: {
        bugs: tracks.length > 0 ? tracks[0].streamingLinks?.bugs || "" : ""
      },
      mediaLinks: {
        musicVideo: musicVideoUrl || "",
        teasers: []
      }
    };
    
    batch.set(comebackRef, comebackData);
    count++;

    // Track artist relations
    if (!artistId.startsWith("UNKNOWN_")) {
      if (!artistUpdates.has(artistId)) {
        // Initialize from map
        let existingMeta = null;
        for (const meta of artistsMap.values()) {
          if (meta.id === artistId) {
             existingMeta = meta; break;
          }
        }
        artistUpdates.set(artistId, {
          recentComebackDate: existingMeta?.recentComebackDate || "0000-00-00",
          recentComebackId: "",
          comebackIds: new Set(existingMeta?.comebackIds || [])
        });
      }
      const updateRef = artistUpdates.get(artistId)!;
      updateRef.comebackIds.add(comebackId);
      
      if (releaseDate > updateRef.recentComebackDate) {
        updateRef.recentComebackDate = releaseDate;
        updateRef.recentComebackId = comebackId;
      }
    }
    
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db); // Reassign
      console.log(`... Committed ${count} comebacks ...`);
    }
  }
  
  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  // Now batch update artists
  console.log(`Updating ${artistUpdates.size} artists with comeback relations...`);
  let artistBatch = writeBatch(db);
  let artistCount = 0;
  for (const [aId, updates] of artistUpdates.entries()) {
    const aRef = doc(db, "artists", aId);
    artistBatch.update(aRef, {
      comebackIds: Array.from(updates.comebackIds),
      ...(updates.recentComebackId ? { recentComebackId: updates.recentComebackId } : {})
    });
    artistCount++;
    if (artistCount % 400 === 0) {
      await artistBatch.commit();
      artistBatch = writeBatch(db); // Reassign
      console.log(`... Committed ${artistCount} artist updates ...`);
    }
  }
  if (artistCount % 400 !== 0) {
    await artistBatch.commit();
  }
  
  console.log(`✅ Success! Inserted ${count} enriched comeback records and updated relations for ${artistCount} artists.`);
}

seedComebacks().catch(console.error);
