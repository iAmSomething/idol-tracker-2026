import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const REMIX_KEYWORDS = ["ver", "remix", "instrumental", "inst", "mix"];

function isRemix(title: string | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return REMIX_KEYWORDS.some(kw => lower.includes(kw));
}

async function run() {
  console.log("🚀 Starting DB cleanup for duplicated comebacks...");
  const snapshot = await getDocs(collection(db, "comebacks"));
  
  // Group comebacks by artistId + releaseDate
  const grouped = new Map<string, any[]>();
  
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.artistId || !data.releaseDate) return;
    const key = `${data.artistId}_${data.releaseDate}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ id: docSnap.id, ...data });
  });

  const docsToDelete = new Set<string>();
  const artistUpdates = new Map<string, { toRemove: string[] }>();
  
  for (const [key, items] of grouped.entries()) {
    if (items.length > 1) {
      console.log(`\n🔍 Found duplicates for ${key}:`);
      
      // Sort items: preferred (non-remix) first, then by track count descending
      items.sort((a, b) => {
        const aRemix = isRemix(a.title);
        const bRemix = isRemix(b.title);
        if (aRemix !== bRemix) return aRemix ? 1 : -1;
        return (b.tracks?.length || 0) - (a.tracks?.length || 0);
      });
      
      // If the primary is also a remix, we should probably delete it too, but let's check
      const primary = items[0];
      if (isRemix(primary.title)) {
        console.log(`  🗑️ Marking Primary for deletion because it's a remix: [${primary.id}] ${primary.title}`);
        docsToDelete.add(primary.id);
        if (!artistUpdates.has(primary.artistId)) artistUpdates.set(primary.artistId, { toRemove: [] });
        artistUpdates.get(primary.artistId)!.toRemove.push(primary.id);
      } else {
        console.log(`  ⭐ Keeping Primary: [${primary.id}] ${primary.title} (${primary.releaseType})`);
      }
      
      for (let i = 1; i < items.length; i++) {
        const dup = items[i];
        console.log(`  🗑️ Marking for deletion: [${dup.id}] ${dup.title}`);
        docsToDelete.add(dup.id);
        
        if (!artistUpdates.has(dup.artistId)) {
          artistUpdates.set(dup.artistId, { toRemove: [] });
        }
        artistUpdates.get(dup.artistId)!.toRemove.push(dup.id);
      }
    } else {
      // Standalone album, but is it a remix?
      const single = items[0];
      if (isRemix(single.title)) {
        console.log(`\n🔍 Found standalone Remix for ${key}:`);
        console.log(`  🗑️ Marking for deletion: [${single.id}] ${single.title}`);
        docsToDelete.add(single.id);
        if (!artistUpdates.has(single.artistId)) {
          artistUpdates.set(single.artistId, { toRemove: [] });
        }
        artistUpdates.get(single.artistId)!.toRemove.push(single.id);
      }
    }
  }
  
  if (docsToDelete.size === 0) {
    console.log("\n✅ No duplicates found.");
    return;
  }
  
  console.log(`\nDeleting ${docsToDelete.size} duplicate comeback(s)...`);
  let batch = writeBatch(db);
  let count = 0;
  
  for (const cid of docsToDelete) {
    batch.delete(doc(db, "comebacks", cid));
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`Cleaning up artist references...`);
  batch = writeBatch(db);
  count = 0;
  for (const [artistId, update] of artistUpdates.entries()) {
    if (artistId.startsWith("UNKNOWN_")) continue; // Unknown artists don't exist in artists collection
    
    const aRef = doc(db, "artists", artistId);
    const aSnap = await getDoc(aRef);
    if (aSnap.exists()) {
      const data = aSnap.data();
      const newComebackIds = (data.comebackIds || []).filter((id: string) => !update.toRemove.includes(id));
      batch.update(aRef, { comebackIds: newComebackIds });
      
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }
  
  if (count % 400 !== 0) {
    await batch.commit();
  }
  console.log("✅ Cleanup complete!");
}

run().catch(console.error);
