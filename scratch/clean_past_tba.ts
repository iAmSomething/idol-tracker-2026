import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import axios from "axios";
import * as cheerio from "cheerio";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function searchBugsForArtistAlbum(artistName: string, targetYear: number, targetMonth: number): Promise<any> {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/album?q=${encodeURIComponent(artistName)}`;
    const res = await axios.get(searchUrl, { timeout: 5000 });
    const $ = cheerio.load(res.data);
    
    let foundAlbum = null;
    
    $('figure.albumInfo').each((i, el) => {
      if (foundAlbum) return;
      
      const title = $(el).find('.albumTitle a').text().trim();
      const artist = $(el).find('.artist a').first().text().trim() || $(el).find('.artistTitle').first().text().trim();
      const releaseDateRaw = $(el).find('time').text().trim(); // "2026.06.17"
      const releaseTypeRaw = $(el).find('.albumType').text().trim();
      const coverUrl = $(el).find('.thumbnail img').attr('src') || '';
      
      // Check if artist matches
      if (artist.includes(artistName) || artistName.includes(artist)) {
        if (releaseDateRaw) {
          const parts = releaseDateRaw.split('.');
          if (parts.length >= 2) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            
            if (year === targetYear && month === targetMonth) {
               let releaseType = "unknown";
               if (releaseTypeRaw.includes('정규')) releaseType = "full";
               else if (releaseTypeRaw.includes('미니')) releaseType = "mini";
               else if (releaseTypeRaw.includes('싱글') || releaseTypeRaw.includes('스페셜')) releaseType = "single";
               
               foundAlbum = {
                 title,
                 releaseDate: releaseDateRaw.replace(/\./g, '-'),
                 releaseType,
                 albumCoverUrl: coverUrl
               };
            }
          }
        }
      }
    });
    
    return foundAlbum;
  } catch (e) {
    console.error(`Bugs search failed for ${artistName}`, e);
    return null;
  }
}

async function run() {
  console.log("Starting past TBA cleanup...");
  const snap = await getDocs(collection(db, "comebacks"));
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  
  const currentDay = today.getDate();
  
  for (const d of snap.docs) {
      const data = d.data();
      const isTba = data.releaseDate?.includes("TBA") || data.title === "TBA";
      
      if (isTba) {
          // Parse date
          // Format usually like "2026-06" or "2026-06-00-TBA" or "2026-07-10"
          const parts = data.releaseDate.split('-');
          if (parts.length >= 2) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
              
              let isPast = false;
              if (year < currentYear) isPast = true;
              else if (year === currentYear && month < currentMonth) isPast = true;
              else if (year === currentYear && month === currentMonth && day > 0 && day < currentDay) isPast = true;
              
              if (isPast) {
                  console.log(`[Past TBA Detected] ${data.artistName} - ${data.releaseDate}`);
                  
                  // Verification: Did they actually release an album in that month?
                  const actualAlbum = await searchBugsForArtistAlbum(data.artistName, year, month);
                  
                  if (actualAlbum) {
                      console.log(`  -> Validated! They released: ${actualAlbum.title} on ${actualAlbum.releaseDate}`);
                      await updateDoc(doc(db, "comebacks", d.id), {
                          title: actualAlbum.title,
                          releaseDate: actualAlbum.releaseDate,
                          releaseType: actualAlbum.releaseType,
                          albumCoverUrl: actualAlbum.albumCoverUrl,
                          isReleased: true // Since it's in the past and verified
                      });
                      console.log(`  -> Updated doc ${d.id}`);
                  } else {
                      console.log(`  -> No album found for ${data.artistName} in ${year}-${month}. Deleting false positive.`);
                      await deleteDoc(doc(db, "comebacks", d.id));
                      console.log(`  -> Deleted doc ${d.id}`);
                  }
                  
                  await new Promise(r => setTimeout(r, 1000));
              }
          }
      }
  }
  
  console.log("Cleanup complete.");
}

run().catch(console.error);
