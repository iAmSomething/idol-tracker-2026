import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { chromium } from 'playwright';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function ddgSearch(page: any, query: string) {
  try {
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const links = await page.$$eval('.result__url', (els: any[]) => els.map((e: any) => e.href));
    return links;
  } catch (err: any) {
    console.error(`Error searching DDG for ${query}:`, err.message);
    return [];
  }
}

async function run() {
  console.log("🚀 Starting Advanced SNS Fetch via Playwright...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const artistSnap = await getDocs(collection(db, "artists"));
  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));

  let batch = writeBatch(db);
  let opCount = 0;
  
  // We'll just fetch a few for now to demonstrate, as fetching 350 will take hours.
  // We filter to artists that are active and missing namuwiki or weverse
  const targets = artists.filter(a => a.isActive && (!a.socialLinks?.weverse || !a.socialLinks?.namuwiki)).slice(0, 50);

  for (let i = 0; i < targets.length; i++) {
    const artist = targets[i];
    console.log(`[${i+1}/${targets.length}] Searching for ${artist.name}...`);
    
    let socialLinks = artist.socialLinks || {};
    let updated = false;
    
    // Weverse search
    if (!socialLinks.weverse) {
      const links = await ddgSearch(page, `site:weverse.io ${artist.name}`);
      const weverseLink = links.find((l: any) => l.includes('weverse.io') && !l.includes('/post/') && !l.includes('/media/'));
      if (weverseLink) {
        socialLinks.weverse = weverseLink;
        updated = true;
      }
      await delay(1000 + Math.random() * 1000);
    }
    
    // Namuwiki search
    if (!socialLinks.namuwiki) {
      const links = await ddgSearch(page, `site:namu.wiki ${artist.name}`);
      const namuLink = links.find((l: any) => l.includes('namu.wiki/w/'));
      if (namuLink) {
        socialLinks.namuwiki = namuLink;
        updated = true;
      }
      await delay(1000 + Math.random() * 1000);
    }
    
    if (updated) {
      batch.update(doc(db, "artists", artist.docId), { socialLinks });
      opCount++;
      if (opCount >= 100) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
  }
  
  if (opCount > 0) {
    await batch.commit();
  }
  
  await browser.close();
  console.log("✅ Playwright SNS Fetch Complete!");
}

run().catch(console.error);
