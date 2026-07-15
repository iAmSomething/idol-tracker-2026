import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: "AIzaSyAaQR2HtiH-KN8hz5aIr4iNn0eWuTsg_yE",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching artists...");
  const artistsSnap = await getDocs(collection(db, "artists"));
  const artists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  console.log("Fetching comebacks with placeholder artistIds...");
  const comebacksSnap = await getDocs(collection(db, "comebacks"));
  const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  let batch = writeBatch(db);
  let updatedComebacks = 0;
  let updatedArtists = 0;

  // Track artist updates in memory before committing
  const artistUpdates = new Map<string, {
    recentComebackDate: string,
    recentComebackId: string,
    comebackIds: Set<string>
  }>();

  for (const cb of comebacks) {
    if (cb.artistId === "group_placeholder" || cb.artistId === "solo_placeholder" || !cb.artistId) {
      console.log(`Trying to link: ${cb.artistName} - ${cb.title}`);
      
      const artist = artists.find(a => {
        const ko = typeof a.name === 'object' ? (a.name.ko || '') : (typeof a.name === 'string' ? a.name : '');
        const en = typeof a.name === 'object' ? (a.name.en || '') : '';
        const aliases = typeof a.name === 'object' ? (a.name.aliases || []) : [];
        
        const sKo = ko.toLowerCase().replace(/\s+/g, '');
        const sEn = en.toLowerCase().replace(/\s+/g, '');
        const search = cb.artistName.toLowerCase().replace(/\s+/g, '');
        
        return sKo === search || sEn === search || sKo.includes(search) || sEn.includes(search) ||
               aliases.some((alias: string) => alias.toLowerCase().replace(/\s+/g, '') === search);
      });

      if (artist) {
        console.log(` -> Found artist match: ${artist.id}`);
        batch.update(doc(db, "comebacks", cb.id), {
          artistId: artist.id
        });
        updatedComebacks++;

        // Initialize update object if not exists
        if (!artistUpdates.has(artist.id)) {
          artistUpdates.set(artist.id, {
            recentComebackDate: artist.recentComebackDate || "0000-00-00",
            recentComebackId: artist.recentComebackId || "",
            comebackIds: new Set(artist.comebackIds || [])
          });
        }

        const updateRef = artistUpdates.get(artist.id)!;
        updateRef.comebackIds.add(cb.id);
        
        if (cb.releaseDate > updateRef.recentComebackDate) {
          updateRef.recentComebackDate = cb.releaseDate;
          updateRef.recentComebackId = cb.id;
        }
      } else {
        console.log(` -> NO ARTIST FOUND FOR: ${cb.artistName}`);
      }
    }
  }

  // Update artists
  for (const [aId, updates] of artistUpdates.entries()) {
    batch.update(doc(db, "artists", aId), {
      comebackIds: Array.from(updates.comebackIds),
      recentComebackDate: updates.recentComebackDate,
      recentComebackId: updates.recentComebackId,
      updatedAt: new Date().toISOString()
    });
    updatedArtists++;
  }

  await batch.commit();
  console.log(`Done. Linked ${updatedComebacks} comebacks to ${updatedArtists} artists.`);
  process.exit(0);
}

run().catch(console.error);
