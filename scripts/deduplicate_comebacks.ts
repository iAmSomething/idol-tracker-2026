import dotenv from 'dotenv';
dotenv.config();
import { db, getActiveArtists } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, limit, writeBatch } from 'firebase/firestore';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, "").trim();
}

function resolveArtistId(artistName: string, artists: any[]): string {
  const normName = normalizeName(artistName);
  if (!normName) return `unknown_${Math.random()}`;

  // 1. Exact match after normalization
  let match = artists.find(a => normalizeName(a.name) === normName);
  if (match) return match.id;

  // 2. Contains check (e.g., "aespa (에스파)" contains "aespa" or "에스파")
  match = artists.find(a => {
    const aNorm = normalizeName(a.name);
    return normName.includes(aNorm) || aNorm.includes(normName);
  });
  if (match) return match.id;

  // 3. Fallback to normalized name as ID
  return normName;
}

function calculateRichness(cb: any): number {
  let score = 0;
  
  // Cover Url check
  if (cb.albumCoverUrl && !cb.albumCoverUrl.includes("unsplash.com")) {
    score += 10;
  }
  
  // Streaming links check
  if (cb.streamingLinks?.bugs) {
    score += 5;
  }
  
  // Tracks check
  if (cb.tracks && cb.tracks.length > 0) {
    score += 10;
  }
  
  // Title tracks check
  if (cb.titleTracks && cb.titleTracks.length > 0) {
    score += 5;
  }
  
  // Music video link
  if (cb.mediaLinks?.musicVideo && !cb.mediaLinks.musicVideo.includes("results?search_query=")) {
    score += 5;
  }
  
  // Agency check
  if (cb.agencyName && cb.agencyName !== "Unknown") {
    score += 3;
  }
  
  // Release type check
  if (cb.releaseType && cb.releaseType !== "unknown") {
    score += 2;
  }
  
  return score;
}

function mergeComebackData(winner: any, loser: any): any {
  const merged = { ...winner };

  // Merge album cover
  if ((!merged.albumCoverUrl || merged.albumCoverUrl.includes("unsplash.com")) && 
      (loser.albumCoverUrl && !loser.albumCoverUrl.includes("unsplash.com"))) {
    merged.albumCoverUrl = loser.albumCoverUrl;
  }

  // Merge tracks
  if ((!merged.tracks || merged.tracks.length === 0) && (loser.tracks && loser.tracks.length > 0)) {
    merged.tracks = loser.tracks;
  }

  // Merge title tracks
  if ((!merged.titleTracks || merged.titleTracks.length === 0) && (loser.titleTracks && loser.titleTracks.length > 0)) {
    merged.titleTracks = loser.titleTracks;
  }

  // Merge streaming links
  merged.streamingLinks = {
    ...(loser.streamingLinks || {}),
    ...(winner.streamingLinks || {})
  };

  // Merge media links
  merged.mediaLinks = {
    ...(loser.mediaLinks || {}),
    ...(winner.mediaLinks || {})
  };
  
  // Deduplicate media link arrays if any
  if (winner.mediaLinks?.teasers || loser.mediaLinks?.teasers) {
    merged.mediaLinks.teasers = [
      ...new Set([
        ...(loser.mediaLinks?.teasers || []),
        ...(winner.mediaLinks?.teasers || [])
      ])
    ];
  }

  // Merge agency
  if ((!merged.agencyName || merged.agencyName === "Unknown") && (loser.agencyName && loser.agencyName !== "Unknown")) {
    merged.agencyName = loser.agencyName;
  }

  // Merge releaseType
  if ((!merged.releaseType || merged.releaseType === "unknown") && (loser.releaseType && loser.releaseType !== "unknown")) {
    merged.releaseType = loser.releaseType;
  }

  return merged;
}

async function runDeduplication() {
  logger.info("Starting Comeback Deduplication and Data Merging...");

  // 1. Fetch all artists and comebacks
  const artists = await getActiveArtists();
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  logger.info(`Loaded ${artists.length} artists and ${comebacks.length} comebacks.`);

  // 2. Resolve artistId for each comeback and group by releaseDate + artistId
  const groups: Record<string, any[]> = {};

  for (const cb of comebacks) {
    if (!cb.releaseDate) continue;
    
    const artistId = cb.artistId || resolveArtistId(cb.artistName, artists);
    const groupKey = `${cb.releaseDate}_${artistId}`;

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(cb);
  }

  // 3. Process each group
  let mergeCount = 0;
  let deleteCount = 0;
  let trackUpdatesCount = 0;

  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;

    logger.info(`\n🔍 Found duplicate group: ${key} (${group.length} items)`);
    
    // Sort group by richness descending
    group.sort((a, b) => calculateRichness(b) - calculateRichness(a));

    const winner = group[0];
    const losers = group.slice(1);

    logger.info(`  👑 WINNER (Highest Richness): "${winner.albumTitle || winner.title}" by ${winner.artistName} (${winner.id})`);
    
    let mergedData = { ...winner };

    for (const loser of losers) {
      logger.info(`  ❌ DUPLICATE (To Merge & Delete): "${loser.albumTitle || loser.title}" by ${loser.artistName} (${loser.id})`);
      mergedData = mergeComebackData(mergedData, loser);
    }

    // 4. Update the winner document
    await updateDoc(doc(db, "comebacks", winner.id), mergedData);
    mergeCount++;

    // 5. Update any tracks pointing to the losers to point to the winner
    const loserIds = losers.map(l => l.id);
    
    // Query tracks
    const tracksQuery = query(collection(db, "tracks"), where("comebackId", "in", loserIds));
    const tracksSnap = await getDocs(tracksQuery);
    
    if (!tracksSnap.empty) {
      logger.info(`  👉 Re-linking ${tracksSnap.size} tracks from duplicates to the winner.`);
      const batch = writeBatch(db);
      tracksSnap.docs.forEach(trackDoc => {
        batch.update(doc(db, "tracks", trackDoc.id), { comebackId: winner.id });
        trackUpdatesCount++;
      });
      await batch.commit();
    }

    // 6. Delete the duplicate comebacks (losers)
    for (const loserId of loserIds) {
      await deleteDoc(doc(db, "comebacks", loserId));
      deleteCount++;
    }
  }

  logger.info(`\n🎉 Deduplication complete!`);
  logger.info(`  - Merged & updated canonical comebacks: ${mergeCount}`);
  logger.info(`  - Deleted duplicate comeback docs: ${deleteCount}`);
  logger.info(`  - Tracks re-linked: ${trackUpdatesCount}`);
  
  process.exit(0);
}

runDeduplication().catch(e => {
  logger.error("Deduplication Critical Failure:", e);
  process.exit(1);
});
