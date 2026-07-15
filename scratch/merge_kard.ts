import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  // 1. Find all KARD related artists
  const artistsSnap = await getDocs(collection(db, "artists"));
  const kardArtists: any[] = [];
  
  for (const d of artistsSnap.docs) {
      const data = d.data();
      const ko = data.name?.ko || data.name;
      if (ko === "카드" || ko === "카드(KARD)" || ko === "KARD" || String(ko).toUpperCase().includes("KARD")) {
          kardArtists.push({ id: d.id, ...data, koName: ko });
      }
  }
  
  console.log("KARD Artists:", kardArtists.map(a => `${a.id} (${a.koName})`));
  
  // We need to keep one canonical artist. Let's pick the one that has the most complete data, or just default to "카드(KARD)".
  // Let's see which one has the longest ID or is older, or just pick the one named "카드(KARD)".
  let canonicalArtist = kardArtists.find(a => a.koName === "카드(KARD)");
  if (!canonicalArtist) canonicalArtist = kardArtists.find(a => a.koName.toUpperCase() === "KARD");
  if (!canonicalArtist && kardArtists.length > 0) canonicalArtist = kardArtists[0];
  
  if (!canonicalArtist || kardArtists.length <= 1) {
      console.log("No duplicates found for artists.");
  } else {
      console.log(`Canonical Artist: ${canonicalArtist.id} (${canonicalArtist.koName})`);
      
      // Delete duplicates and update their aliases
      const newAliases = new Set(canonicalArtist.name?.aliases || []);
      for (const a of kardArtists) {
          if (a.id !== canonicalArtist.id) {
              newAliases.add(a.koName);
              if (a.name?.en) newAliases.add(a.name.en);
              if (a.name?.aliases) a.name.aliases.forEach((alias: string) => newAliases.add(alias));
              console.log(`Deleting duplicate artist: ${a.id} (${a.koName})`);
              await deleteDoc(doc(db, "artists", a.id));
          }
      }
      
      // Update canonical artist aliases
      await updateDoc(doc(db, "artists", canonicalArtist.id), {
          "name.aliases": Array.from(newAliases)
      });
  }
  
  const canonicalArtistId = canonicalArtist?.id;
  const canonicalArtistName = "카드(KARD)"; // Standardize the name

  if (!canonicalArtistId) {
      console.log("No canonical artist found. Exiting.");
      return;
  }

  // 2. Find all KARD related comebacks
  const cbsSnap = await getDocs(collection(db, "comebacks"));
  const kardCbs: any[] = [];
  
  for (const d of cbsSnap.docs) {
      const data = d.data();
      const aName = data.artistName || "";
      if (aName === "카드" || aName === "카드(KARD)" || aName === "KARD") {
          kardCbs.push({ id: d.id, ...data });
      }
  }
  
  console.log(`Found ${kardCbs.length} comebacks for KARD.`);
  
  // Group by date
  const cbsByDate: Record<string, any[]> = {};
  for (const cb of kardCbs) {
      if (!cbsByDate[cb.releaseDate]) cbsByDate[cb.releaseDate] = [];
      cbsByDate[cb.releaseDate].push(cb);
  }
  
  for (const [date, cbs] of Object.entries(cbsByDate)) {
      if (cbs.length > 1) {
          console.log(`Duplicate comebacks found on ${date}:`, cbs.map(c => c.id));
          // Keep the first one, delete the rest, but merge recentNews
          const canonicalCb = cbs[0];
          let mergedNews: any[] = canonicalCb.recentNews || [];
          
          for (let i = 1; i < cbs.length; i++) {
              const dupCb = cbs[i];
              if (dupCb.recentNews) {
                  for (const n of dupCb.recentNews) {
                      if (!mergedNews.some(mn => mn.link === n.link)) {
                          mergedNews.push(n);
                      }
                  }
              }
              console.log(`Deleting duplicate comeback: ${dupCb.id}`);
              await deleteDoc(doc(db, "comebacks", dupCb.id));
          }
          
          console.log(`Updating canonical comeback: ${canonicalCb.id}`);
          await updateDoc(doc(db, "comebacks", canonicalCb.id), {
              artistId: canonicalArtistId,
              artistName: canonicalArtistName,
              recentNews: mergedNews
          });
      } else {
          // Just update the artist name and ID
          console.log(`Updating comeback artist mapping: ${cbs[0].id}`);
          await updateDoc(doc(db, "comebacks", cbs[0].id), {
              artistId: canonicalArtistId,
              artistName: canonicalArtistName
          });
      }
  }
  
  console.log("Done merging KARD.");
}

run().catch(console.error);
