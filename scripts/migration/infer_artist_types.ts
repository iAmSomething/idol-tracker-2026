import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  logger.info("Starting artist type inference...");

  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(d => ({ docId: d.id, ...d.data() as any }));

  // Find comebacks with missing or unknown artistType
  const needsType = comebacks.filter(c => !c.artistType || c.artistType === 'unknown');
  
  if (needsType.length === 0) {
    logger.info("No comebacks need artist type inference.");
    process.exit(0);
  }

  // Get unique artist names
  const artistNames = Array.from(new Set(needsType.map(c => c.artistName)));
  logger.info(`Found ${artistNames.length} unique artists needing type inference.`);

  // Ask Gemini to classify
  const prompt = `
  Classify the following K-pop artist names into exactly one of: "group", "solo", or "unit".
  
  Artists:
  ${JSON.stringify(artistNames)}
  
  Return a JSON object where the keys are the artist names and the values are the classification ("group", "solo", "unit").
  Return ONLY the JSON object.
  `;

  let classifications: Record<string, string> = {};
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (response.text) {
      const text = response.text.trim();
      const cleaned = text.startsWith("\`\`\`") ? text.replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`$/, "").trim() : text;
      classifications = JSON.parse(cleaned);
    }
  } catch (e) {
    logger.error("Gemini classification failed:", e);
    process.exit(1);
  }

  logger.info("Classification successful:", classifications);

  // Load existing artists to avoid overwriting
  const artistSnap = await getDocs(collection(db, "artists"));
  const existingArtists = new Set(artistSnap.docs.map(d => {
      const data = d.data();
      return typeof data.name === 'object' ? data.name.ko || data.name.en : data.name;
  }));

  let batch = writeBatch(db);
  let updateCount = 0;

  for (const cb of needsType) {
    const type = classifications[cb.artistName];
    if (type && ["group", "solo", "unit"].includes(type)) {
      batch.update(doc(db, "comebacks", cb.docId), { artistType: type });
      updateCount++;

      // Also ensure artist document exists
      const canonicalId = cb.artistName.toLowerCase().replace(/[^a-z0-9가-힣]/g, "").trim();
      if (!existingArtists.has(cb.artistName) && canonicalId) {
        batch.set(doc(db, "artists", canonicalId), {
          name: { ko: cb.artistName, en: "", aliases: [] },
          type: type,
          generation: 0,
          members: [],
          isActive: true,
          socialLinks: {}
        }, { merge: true });
        existingArtists.add(cb.artistName);
      }
      
      // update comeback artistId as well to match canonical if missing
      if (!cb.artistId || cb.artistId === 'unknown') {
          batch.update(doc(db, "comebacks", cb.docId), { artistId: canonicalId });
      }

      if (updateCount % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }

  if (updateCount % 400 !== 0) {
    await batch.commit();
  }

  logger.info(`Finished! Updated artistType for ${updateCount} comebacks and created missing artist docs.`);
  process.exit(0);
}

run().catch(e => {
  logger.error("Inference Failed", e);
  process.exit(1);
});
