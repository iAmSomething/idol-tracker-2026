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

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function run() {
  console.log("🚀 Starting Agency Migration...");
  const artistSnap = await getDocs(collection(db, "artists"));
  const artists = artistSnap.docs.map(d => ({ docId: d.id, ...d.data() } as any));

  const uniqueAgencies = new Set();
  
  // Extract all agency names
  for (const artist of artists) {
    if (artist.agency && typeof artist.agency === 'string') {
      uniqueAgencies.add(artist.agency);
    } else if (artist.agency?.name) {
      uniqueAgencies.add(artist.agency.name);
    }
  }

  console.log(`Found ${uniqueAgencies.size} unique agencies. Creating agency docs...`);

  // Create Agency docs
  let batch = writeBatch(db);
  let opCount = 0;
  
  const agencySlugMap: any = {};

  for (const agencyName of uniqueAgencies) {
    const slug = slugify(agencyName as string) || `agency-${Math.random().toString(36).substring(2, 9)}`;
    agencySlugMap[agencyName as string] = slug;

    const agencyRef = doc(db, "agencies", slug);
    batch.set(agencyRef, {
      id: slug,
      name: agencyName,
      socialLinks: {}
    }, { merge: true });

    opCount++;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }
  
  console.log("✅ Agencies created! Now updating artists...");

  // Update artists to reference agencyId
  for (const artist of artists) {
    let agencyName = null;
    if (artist.agency && typeof artist.agency === 'string') {
      agencyName = artist.agency;
    } else if (artist.agency?.name) {
      agencyName = artist.agency.name;
    }

    if (agencyName && agencySlugMap[agencyName]) {
      const artistRef = doc(db, "artists", artist.docId);
      
      // Update: Set agencyId and convert the old string to the new structure matching index.ts
      batch.update(artistRef, {
        agencyId: agencySlugMap[agencyName],
        // Actually, we'll just keep the name and add id to it for backwards compatibility if needed
        agency: {
          id: agencySlugMap[agencyName],
          name: agencyName
        }
      });
      
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log("🎉 Migration Complete!");
}

run().catch(console.error);
