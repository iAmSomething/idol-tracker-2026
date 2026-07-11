import dotenv from 'dotenv';
dotenv.config();
import { db, getActiveArtists } from './lib/firebase-helpers';
import { logger } from './lib/logger';
import { doc, updateDoc } from 'firebase/firestore';
import { chromium } from 'playwright';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function ddgSearch(page: any, query: string) {
  try {
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const links = await page.$$eval('.result__url', (els: any[]) => els.map((e: any) => e.href));
    return links;
  } catch (err: any) {
    logger.error(`Error searching DDG for ${query}:`, err.message);
    return [];
  }
}

// Zero-dependency concurrency runner
async function runConcurrent(tasks: (() => Promise<void>)[], maxConcurrency: number) {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= maxConcurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

async function run() {
  logger.info("🚀 Starting Advanced SNS Fetch via Playwright (Concurrent Pool)...");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  });
  
  // 1. Fetch artists from centralized helper
  const artists = await getActiveArtists();
  
  // Filter to active artists missing Namuwiki or Weverse links
  const targets = artists.filter(a => a.isActive && (!a.socialLinks?.weverse || !a.socialLinks?.namuwiki)).slice(0, 30);
  logger.info(`Found ${targets.length} targets. Running concurrency pool (Max 3 concurrent tabs)...`);

  const concurrencyLimit = parseInt(process.env.PLAYWRIGHT_MAX_CONCURRENT || '3', 10);

  const tasks = targets.map((artist, idx) => async () => {
    // Create new tab for this specific task
    const page = await context.newPage();
    try {
      logger.info(`[${idx + 1}/${targets.length}] Analyzing: "${artist.name}"`);
      let socialLinks = artist.socialLinks || {};
      let updated = false;

      // 1. Weverse search
      if (!socialLinks.weverse) {
        const links = await ddgSearch(page, `site:weverse.io ${artist.name}`);
        const weverseLink = links.find((l: any) => l.includes('weverse.io') && !l.includes('/post/') && !l.includes('/media/'));
        if (weverseLink) {
          socialLinks.weverse = weverseLink;
          updated = true;
          logger.info(`   -> Found Weverse: ${weverseLink}`);
        }
        await delay(1000 + Math.random() * 1000);
      }

      // 2. Namuwiki search
      if (!socialLinks.namuwiki) {
        const links = await ddgSearch(page, `site:namu.wiki ${artist.name}`);
        const namuLink = links.find((l: any) => l.includes('namu.wiki/w/'));
        if (namuLink) {
          socialLinks.namuwiki = namuLink;
          updated = true;
          logger.info(`   -> Found Namuwiki: ${namuLink}`);
        }
        await delay(1000 + Math.random() * 1000);
      }

      if (updated) {
        await updateDoc(doc(db, "artists", artist.id), { socialLinks });
      }
    } catch (err: any) {
      logger.error(`Error processing "${artist.name}":`, err.message);
    } finally {
      await page.close();
    }
  });

  await runConcurrent(tasks, concurrencyLimit);
  
  await browser.close();
  logger.info("✅ Playwright SNS Fetch Complete!");
  process.exit(0);
}

run().catch(e => {
  logger.error("Advanced SNS Fetch Critical Failure:", e);
  process.exit(1);
});
