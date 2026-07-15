import dotenv from 'dotenv';
dotenv.config();
import { db, getActiveArtists } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, writeBatch } from 'firebase/firestore';

function normalizeName(name: any): string {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, "").trim();
}

function areArtistsFuzzilyEqual(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Containment check for longer/shorter name mapping (e.g. "에스파" and "aespa에스파")
  if (norm1.length >= 2 && norm2.length >= 2) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }
  return false;
}

function resolveCanonicalArtist(artistName: string, artists: any[]): { id: string; name: string } {
  const normName = normalizeName(artistName);

  // Find the canonical artist from the artists collection
  const match = artists.find(a => {
    const aNorm = normalizeName(a.name);
    return aNorm === normName || (aNorm.length >= 2 && normName.includes(aNorm)) || (normName.length >= 2 && aNorm.includes(normName));
  });

  if (match) {
    return { id: match.id, name: match.name };
  }
  return { id: normName, name: artistName }; // Fallback
}

function calculateRichness(cb: any): number {
  let score = 0;
  
  if (cb.albumCoverUrl && !cb.albumCoverUrl.includes("unsplash.com")) {
    score += 10;
  }
  if (cb.streamingLinks?.bugs) {
    score += 5;
  }
  if (cb.tracks && cb.tracks.length > 0) {
    score += 10;
  }
  if (cb.titleTracks && cb.titleTracks.length > 0) {
    score += 5;
  }
  if (cb.mediaLinks?.musicVideo && !cb.mediaLinks.musicVideo.includes("results?search_query=")) {
    score += 5;
  }
  if (cb.agencyName && cb.agencyName !== "Unknown") {
    score += 3;
  }
  if (cb.releaseType && cb.releaseType !== "unknown") {
    score += 2;
  }
  
  return score;
}

function mergeComebackData(winner: any, loser: any): any {
  const merged = { ...winner };

  if ((!merged.albumCoverUrl || merged.albumCoverUrl.includes("unsplash.com")) && 
      (loser.albumCoverUrl && !loser.albumCoverUrl.includes("unsplash.com"))) {
    merged.albumCoverUrl = loser.albumCoverUrl;
  }

  if ((!merged.tracks || merged.tracks.length === 0) && (loser.tracks && loser.tracks.length > 0)) {
    merged.tracks = loser.tracks;
  }

  if ((!merged.titleTracks || merged.titleTracks.length === 0) && (loser.titleTracks && loser.titleTracks.length > 0)) {
    merged.titleTracks = loser.titleTracks;
  }

  merged.streamingLinks = {
    ...(loser.streamingLinks || {}),
    ...(winner.streamingLinks || {})
  };

  merged.mediaLinks = {
    ...(loser.mediaLinks || {}),
    ...(winner.mediaLinks || {})
  };
  
  if (winner.mediaLinks?.teasers || loser.mediaLinks?.teasers) {
    merged.mediaLinks.teasers = [
      ...new Set([
        ...(loser.mediaLinks?.teasers || []),
        ...(winner.mediaLinks?.teasers || [])
      ])
    ];
  }

  if ((!merged.agencyName || merged.agencyName === "Unknown") && (loser.agencyName && loser.agencyName !== "Unknown")) {
    merged.agencyName = loser.agencyName;
  }

  if ((!merged.releaseType || merged.releaseType === "unknown") && (loser.releaseType && loser.releaseType !== "unknown")) {
    merged.releaseType = loser.releaseType;
  }

  return merged;
}

async function runDeduplication() {
  logger.info("Starting Advanced Comeback Deduplication (Fuzzy Name & Date Grouping)...");

  // 1. Fetch all canonical artists and comebacks
  const artists = await getActiveArtists();
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  logger.info(`Loaded ${artists.length} artists and ${comebacks.length} comebacks.`);

  // 2. Group comebacks by releaseDate, then fuzzily group by artistName
  const processedIds = new Set<string>();
  let mergeCount = 0;
  let deleteCount = 0;
  let trackUpdatesCount = 0;

  for (let i = 0; i < comebacks.length; i++) {
    const cb1 = comebacks[i];
    if (processedIds.has(cb1.id) || !cb1.releaseDate) continue;

    // Find all duplicates for this comeback
    const group = [cb1];
    for (let j = i + 1; j < comebacks.length; j++) {
      const cb2 = comebacks[j];
      if (processedIds.has(cb2.id) || !cb2.releaseDate) continue;

      if (cb1.releaseDate === cb2.releaseDate && areArtistsFuzzilyEqual(cb1.artistName, cb2.artistName)) {
        group.push(cb2);
      }
    }

    if (group.length > 1) {
      // Mark all in group as processed
      group.forEach(g => processedIds.add(g.id));

      logger.info(`\n🔍 Found duplicate group for date: ${cb1.releaseDate} (${group.length} items)`);
      
      // Sort group by richness descending
      group.sort((a, b) => calculateRichness(b) - calculateRichness(a));

      const winner = group[0];
      const losers = group.slice(1);

      // Resolve the canonical artist ID for the winner
      const canonicalArtist = resolveCanonicalArtist(winner.artistName, artists);
      logger.info(`  👑 WINNER: "${winner.albumTitle || winner.title || 'TBA'}" by ${winner.artistName} (${winner.id})`);
      logger.info(`     -> Canonical Artist Mapping: ID "${canonicalArtist.id}" (${canonicalArtist.name})`);

      let mergedData = { 
        ...winner,
        artistName: canonicalArtist.name,
        artistId: canonicalArtist.id
      };

      for (const loser of losers) {
        logger.info(`  ❌ DUPLICATE: "${loser.albumTitle || loser.title || 'TBA'}" by ${loser.artistName} (${loser.id})`);
        mergedData = mergeComebackData(mergedData, loser);
      }

      // Update winner comeback in Firestore
      await updateDoc(doc(db, "comebacks", winner.id), mergedData);
      mergeCount++;

      // Update associated tracks to point to the winner ID
      const loserIds = losers.map(l => l.id);
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

      // Delete duplicate comebacks (losers)
      for (const loserId of loserIds) {
        await deleteDoc(doc(db, "comebacks", loserId));
        deleteCount++;
      }
    }
  }

  logger.info(`\n🎉 Fuzzy Deduplication complete!`);
  logger.info(`  - Merged & updated canonical comebacks: ${mergeCount}`);
  logger.info(`  - Deleted duplicate comeback docs: ${deleteCount}`);
  logger.info(`  - Tracks re-linked: ${trackUpdatesCount}`);
  
  process.exit(0);
}

runDeduplication().catch(e => {
  logger.error("Deduplication Critical Failure:", e);
  process.exit(1);
});
