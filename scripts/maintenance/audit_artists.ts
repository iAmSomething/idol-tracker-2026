import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to delay between requests
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWikidataDetails(searchName: string): Promise<{ko: string, en: string, aliases: string[]} | null> {
  const headers = {
    "User-Agent": "IdolTracker/1.0 (Contact: user@example.com)",
    "Accept": "application/json"
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cleanSearchName = searchName.replace(/\s*\(.*?\)\s*/g, '').trim();
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanSearchName)}&language=en&format=json`;
      const searchRes = await fetch(searchUrl, { headers });
      
      if (searchRes.status === 429) {
        console.log(`Rate limited on attempt ${attempt}. Waiting...`);
        await sleep(3000 * attempt);
        continue;
      }
      
      const searchData = await searchRes.json();
      
      if (!searchData.search || searchData.search.length === 0) {
        return null;
      }
      
      const entityId = searchData.search[0].id;
      const getUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=labels|aliases&languages=ko|en&format=json`;
      const getRes = await fetch(getUrl, { headers });
      const getData = await getRes.json();
    const entity = getData.entities[entityId];
    
    const nameKo = entity.labels?.ko?.value || null;
    const nameEn = entity.labels?.en?.value || null;
    
    const aliasesKo = (entity.aliases?.ko || []).map((a: any) => a.value);
    const aliasesEn = (entity.aliases?.en || []).map((a: any) => a.value);
    
    const aliasesSet = new Set<string>([...aliasesKo, ...aliasesEn]);
    
    // We strictly want Korean or English label to exist.
    if (!nameKo && !nameEn) return null;
    
      return {
        ko: nameKo || nameEn || searchName,
        en: nameEn || nameKo || searchName,
        aliases: Array.from(aliasesSet)
      };
    } catch (e) {
      console.error(`Error fetching Wikidata for ${searchName} (Attempt ${attempt}):`, e.message);
      await sleep(2000 * attempt);
    }
  }
  return null;
}

async function runAudit() {
  console.log("Fetching all artists from Firestore...");
  const snap = await getDocs(collection(db, 'artists'));
  const docs = snap.docs;
  console.log(`Found ${docs.length} artists in DB.`);
  
  let updatedCount = 0;
  
  // We process in batches of 100 to avoid Firestore limits
  const batches = [];
  let currentBatch = writeBatch(db);
  let batchOpCount = 0;
  
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const data = d.data();
    const id = d.id;
    
    let needsUpdate = false;
    let baseNameStr = "";
    
    if (typeof data.name === "string") {
      baseNameStr = data.name;
      needsUpdate = true;
    } else if (typeof data.name === "object") {
      baseNameStr = data.name.en || data.name.ko || "Unknown";
      
      const hasKo = !!data.name.ko;
      const hasEn = !!data.name.en;
      const hasAliases = Array.isArray(data.name.aliases) && data.name.aliases.length > 0;
      
      // If it's severely missing data (no Korean, or no aliases), we update it.
      if (!hasKo || !hasEn || !hasAliases) {
        needsUpdate = true;
      }
    }
    
    if (needsUpdate && baseNameStr && baseNameStr !== "Unknown") {
      console.log(`[${i + 1}/${docs.length}] Auditing: ${baseNameStr}...`);
      const wikiData = await fetchWikidataDetails(baseNameStr);
      
      if (wikiData) {
        const finalNameObj = {
          ko: wikiData.ko,
          en: wikiData.en,
          aliases: Array.from(new Set([
            ...wikiData.aliases,
            baseNameStr, // Ensure the base search name is always an alias just in case
            ...(typeof data.name === "object" && data.name.ko ? [data.name.ko] : []),
            ...(typeof data.name === "object" && data.name.en ? [data.name.en] : [])
          ]))
        };
        
        console.log(`  ✅ Resolved: ${finalNameObj.ko} / ${finalNameObj.en} | Aliases: ${finalNameObj.aliases.length} items`);
        
        currentBatch.update(doc(db, 'artists', id), { name: finalNameObj });
        batchOpCount++;
        updatedCount++;
        
        if (batchOpCount >= 400) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchOpCount = 0;
        }
        
        // Wait 1500ms to avoid hammering Wikidata API
        await sleep(1500);
      } else {
        console.log(`  ❌ Could not resolve Wikidata for: ${baseNameStr}. Skipping.`);
      }
    }
  }
  
  if (batchOpCount > 0) {
    batches.push(currentBatch);
  }
  
  console.log(`\n===========================================`);
  console.log(`Audit complete. Proceeding to commit ${batches.length} batches (${updatedCount} artists updated)...`);
  
  for (let b = 0; b < batches.length; b++) {
    await batches[b].commit();
    console.log(`Batch ${b + 1} committed.`);
  }
  
  console.log("Migration finished successfully!");
  process.exit(0);
}

runAudit();
