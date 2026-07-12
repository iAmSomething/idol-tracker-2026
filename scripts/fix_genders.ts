import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import axios from 'axios';
import * as cheerio from 'cheerio';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchCorrectGender(artistName: string) {
  try {
    const searchUrl = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(artistName)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    const $search = cheerio.load(searchRes.data);
    
    const detailUrl = $search('figure.artistInfo a.thumbnail').first().attr('href');
    if (!detailUrl) return null;

    const detailRes = await axios.get(detailUrl, { timeout: 5000 });
    const $detail = cheerio.load(detailRes.data);
    
    // Only get the first artistType element which belongs to the artist, not related artists
    const artistTypeStr = $detail('table.info tbody tr').text().replace(/\s+/g, ' ');
    
    let gender: "male" | "female" | "mixed" | undefined;
    // We check specifically what it says in the info table
    if (artistTypeStr.includes('(여성)')) gender = 'female';
    else if (artistTypeStr.includes('(남성)')) gender = 'male';
    else if (artistTypeStr.includes('(혼성)')) gender = 'mixed';
    
    return gender;
  } catch (e: any) {
    return null;
  }
}

async function fixGenders() {
  console.log("Starting to fix artist genders...");
  
  const artistsSnap = await getDocs(collection(db, "artists"));
  const artists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  let batch = writeBatch(db);
  let count = 0;

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const correctGender = await fetchCorrectGender(artist.name.ko);
    
    if (correctGender && artist.gender !== correctGender) {
      console.log(`Fixing ${artist.name.ko}: ${artist.gender} -> ${correctGender}`);
      batch.update(doc(db, "artists", artist.id), { gender: correctGender });
      count++;
      
      // Update comebacks as well
      const comebacksSnap = await getDocs(collection(db, "comebacks"));
      comebacksSnap.docs.forEach(cDoc => {
        if (cDoc.data().artistId === artist.id) {
          batch.update(doc(db, "comebacks", cDoc.id), { artistGender: correctGender });
          count++;
        }
      });
      
      if (count > 200) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    await delay(100);
  }

  if (count > 0) {
    await batch.commit();
  }
  
  console.log("Gender fix complete!");
  process.exit(0);
}

fixGenders().catch(console.error);
