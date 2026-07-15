import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc, updateDoc } from "firebase/firestore";
import axios from 'axios';
import * as cheerio from 'cheerio';

const firebaseConfig = { projectId: "idol-tracker-2026", appId: "1:47996752520:web:bc7ebc5147da03ef769e59" };
const db = getFirestore(initializeApp(firebaseConfig));

async function getBugsSearch(artistName: string, expectedDate: string) {
  try {
    const res = await axios.get(`https://music.bugs.co.kr/search/album?q=${encodeURIComponent(artistName)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(res.data);
    let found = null;
    $('figure.albumInfo').each((i, el) => {
        if (found) return;
        const title = $(el).find('.albumTitle a').text().trim();
        const coverUrlRaw = $(el).find('.thumbnail img').attr('src') || '';
        const releaseDateRaw = $(el).find('time').text().trim();
        const releaseDate = releaseDateRaw.replace(/\./g, '-');
        if (releaseDate === expectedDate || releaseDate === '2026-07-12' || releaseDate === '2026-07-14') {
            const coverUrl = coverUrlRaw.split('?')[0] + '?type=m1000';
            found = { title, coverUrl };
        }
    });
    return found;
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function run() {
  // 1. Delete the 2 false positives
  console.log("Deleting false positives...");
  await deleteDoc(doc(db, "comebacks", "AmrhV5ySJxkbPos7WNQH")); // Nicole
  await deleteDoc(doc(db, "comebacks", "yqwjECEYspTVKV9gtqN7")); // Identity
  console.log("Deleted.");
  
  // 2. Update the 5 empty ones on 13th
  const targets = [
      { id: "WOOAH_2026-07-13", artist: "WOOAH", searchWord: "WOOAH" },
      { id: "디렉션(D:D)_2026-07-13", artist: "디렉션(D:D)", searchWord: "디렉션" },
      { id: "손준형_2026-07-13", artist: "손준형", searchWord: "손준형" },
      { id: "아이덴티티_2026-07-13", artist: "아이덴티티", searchWord: "아이덴티티" },
      { id: "영파씨_2026-07-13", artist: "영파씨", searchWord: "영파씨" }
  ];

  for (const t of targets) {
      console.log(`Searching Bugs for ${t.artist}...`);
      const res = await getBugsSearch(t.searchWord, "2026-07-13");
      if (res) {
          console.log(`Found: ${res.title}, ${res.coverUrl}`);
          await updateDoc(doc(db, "comebacks", t.id), {
              title: res.title,
              albumCoverUrl: res.coverUrl
          });
      } else {
          console.log(`Not found for ${t.artist}`);
      }
  }
}
run();
