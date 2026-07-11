import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const comebacksSnap = await getDocs(collection(db, 'comebacks'));
  const artistsSnap = await getDocs(collection(db, 'artists'));
  
  const artists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const comebacks = comebacksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const now = new Date();
  
  console.log("=== 📅 예정된 컴백 리스트 DB 현황 ===\n");
  for (const c of comebacks) {
    if (!c.date) continue;
    
    const parts = c.date.split('-');
    if (parts.length !== 3) continue;
    
    const cbDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const daysUntil = (cbDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysUntil >= -1 && daysUntil <= 60) {
      const a = artists.find(x => {
        const ko = typeof x.name === 'object' ? (x.name.ko || '') : (typeof x.name === 'string' ? x.name : '');
        const en = typeof x.name === 'object' ? (x.name.en || '') : '';
        const sKo = ko.toLowerCase().replace(/\s+/g, '');
        const sEn = en.toLowerCase().replace(/\s+/g, '');
        const search = c.artistName.toLowerCase().replace(/\s+/g, '');
        return sKo === search || sEn === search || sKo.includes(search) || sEn.includes(search);
      });
      
      const hasYt = a && a.socialLinks?.youtube ? "✅ O" : "❌ X";
      const ytUrl = a && a.socialLinks?.youtube ? a.socialLinks.youtube : "없음";
      const hasVideo = c.videoUrl ? `✅ [링크확보]` : "❌ [티저없음]";
      
      console.log(`🎤 ${c.artistName} (${c.date})`);
      console.log(`  - 유튜브 채널 등록: ${hasYt} (${ytUrl})`);
      console.log(`  - 2차 보강 완료 여부: ${hasVideo}`);
      console.log(`  - 썸네일 이미지: ${c.conceptImage ? "✅ O" : "❌ X"}`);
      console.log("--------------------------------------------------");
    }
  }

  process.exit(0);
}

run();
