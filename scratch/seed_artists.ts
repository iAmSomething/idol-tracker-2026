import * as path from "path";
import * as dotenv from "dotenv";
import { db } from "../scripts/lib/firebase-helpers";
import { collection, addDoc, getDocs } from "firebase/firestore";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Top ~100 Active K-Pop Groups and Soloists Seed Data
const seedData = [
  // Boy Groups
  { name: { ko: "방탄소년단", en: "BTS" }, aliases: ["BTS", "방탄"], type: "group", gender: "male" },
  { name: { ko: "세븐틴", en: "SEVENTEEN" }, aliases: ["SEVENTEEN", "SVT"], type: "group", gender: "male" },
  { name: { ko: "투모로우바이투게더", en: "TXT" }, aliases: ["TXT", "투바투", "TOMORROW X TOGETHER"], type: "group", gender: "male" },
  { name: { ko: "엔하이픈", en: "ENHYPEN" }, aliases: ["ENHYPEN", "엔픈"], type: "group", gender: "male" },
  { name: { ko: "스트레이 키즈", en: "Stray Kids" }, aliases: ["Stray Kids", "스키즈"], type: "group", gender: "male" },
  { name: { ko: "에이티즈", en: "ATEEZ" }, aliases: ["ATEEZ"], type: "group", gender: "male" },
  { name: { ko: "엔시티", en: "NCT" }, aliases: ["NCT 127", "NCT DREAM", "WayV", "NCT WISH", "엔시티 드림", "엔시티 127"], type: "group", gender: "male" },
  { name: { ko: "라이즈", en: "RIIZE" }, aliases: ["RIIZE"], type: "group", gender: "male" },
  { name: { ko: "보이넥스트도어", en: "BOYNEXTDOOR" }, aliases: ["BOYNEXTDOOR", "보넥도"], type: "group", gender: "male" },
  { name: { ko: "투어스", en: "TWS" }, aliases: ["TWS"], type: "group", gender: "male" },
  { name: { ko: "제로베이스원", en: "ZEROBASEONE" }, aliases: ["ZEROBASEONE", "제베원", "ZB1"], type: "group", gender: "male" },
  { name: { ko: "더보이즈", en: "THE BOYZ" }, aliases: ["THE BOYZ", "더보이즈"], type: "group", gender: "male" },
  { name: { ko: "엑소", en: "EXO" }, aliases: ["EXO"], type: "group", gender: "male" },
  { name: { ko: "샤이니", en: "SHINee" }, aliases: ["SHINee"], type: "group", gender: "male" },
  { name: { ko: "비투비", en: "BTOB" }, aliases: ["BTOB"], type: "group", gender: "male" },
  { name: { ko: "몬스타엑스", en: "MONSTA X" }, aliases: ["MONSTA X", "몬엑"], type: "group", gender: "male" },
  { name: { ko: "데이식스", en: "DAY6" }, aliases: ["DAY6"], type: "group", gender: "male" },
  
  // Girl Groups
  { name: { ko: "블랙핑크", en: "BLACKPINK" }, aliases: ["BLACKPINK", "블핑"], type: "group", gender: "female" },
  { name: { ko: "트와이스", en: "TWICE" }, aliases: ["TWICE"], type: "group", gender: "female" },
  { name: { ko: "레드벨벳", en: "Red Velvet" }, aliases: ["Red Velvet", "레벨"], type: "group", gender: "female" },
  { name: { ko: "에스파", en: "aespa" }, aliases: ["aespa"], type: "group", gender: "female" },
  { name: { ko: "아이브", en: "IVE" }, aliases: ["IVE"], type: "group", gender: "female" },
  { name: { ko: "르세라핌", en: "LE SSERAFIM" }, aliases: ["LE SSERAFIM", "르세라핌"], type: "group", gender: "female" },
  { name: { ko: "뉴진스", en: "NewJeans" }, aliases: ["NewJeans", "뉴진스"], type: "group", gender: "female" },
  { name: { ko: "엔믹스", en: "NMIXX" }, aliases: ["NMIXX"], type: "group", gender: "female" },
  { name: { ko: "아이들", en: "(G)I-DLE" }, aliases: ["(G)I-DLE", "여자아이들", "(여자)아이들"], type: "group", gender: "female" },
  { name: { ko: "잇지", en: "ITZY" }, aliases: ["ITZY"], type: "group", gender: "female" },
  { name: { ko: "스테이씨", en: "STAYC" }, aliases: ["STAYC"], type: "group", gender: "female" },
  { name: { ko: "아이릿", en: "ILLIT" }, aliases: ["ILLIT", "아일릿"], type: "group", gender: "female" },
  { name: { ko: "베이비몬스터", en: "BABYMONSTER" }, aliases: ["BABYMONSTER", "베몬"], type: "group", gender: "female" },
  { name: { ko: "프로미스나인", en: "fromis_9" }, aliases: ["fromis_9", "프나"], type: "group", gender: "female" },
  { name: { ko: "키스오브라이프", en: "KISS OF LIFE" }, aliases: ["KISS OF LIFE", "키오프"], type: "group", gender: "female" },
  { name: { ko: "오마이걸", en: "OH MY GIRL" }, aliases: ["OH MY GIRL", "옴걸"], type: "group", gender: "female" },
  { name: { ko: "마마무", en: "MAMAMOO" }, aliases: ["MAMAMOO"], type: "group", gender: "female" },
  
  // Soloists / Units / Bands
  { name: { ko: "아이유", en: "IU" }, aliases: ["IU"], type: "solo", gender: "female" },
  { name: { ko: "태연", en: "TAEYEON" }, aliases: ["TAEYEON"], type: "solo", gender: "female" },
  { name: { ko: "백현", en: "BAEKHYUN" }, aliases: ["BAEKHYUN"], type: "solo", gender: "male" },
  { name: { ko: "지코", en: "ZICO" }, aliases: ["ZICO"], type: "solo", gender: "male" },
  { name: { ko: "선미", en: "SUNMI" }, aliases: ["SUNMI"], type: "solo", gender: "female" },
  { name: { ko: "청하", en: "CHUNG HA" }, aliases: ["CHUNG HA"], type: "solo", gender: "female" },
  { name: { ko: "임영웅", en: "Lim Young Woong" }, aliases: ["Lim Young Woong"], type: "solo", gender: "male" },
  { name: { ko: "악뮤", en: "AKMU" }, aliases: ["AKMU", "악동뮤지션"], type: "group", gender: "mixed" },
  { name: { ko: "루시", en: "LUCY" }, aliases: ["LUCY"], type: "group", gender: "male" },
  { name: { ko: "권은비", en: "KWON EUNBI" }, aliases: ["KWON EUNBI"], type: "solo", gender: "female" }
];

async function seedDatabase() {
  console.log("Checking existing artists...");
  const snap = await getDocs(collection(db, "artists"));
  const existingKeys = new Set();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.name && data.name.ko) existingKeys.add(data.name.ko);
  });

  console.log(`Found ${existingKeys.size} existing artists.`);
  
  let added = 0;
  for (const artist of seedData) {
    if (!existingKeys.has(artist.name.ko)) {
      await addDoc(collection(db, "artists"), {
        ...artist,
        createdAt: new Date().toISOString()
      });
      added++;
      console.log(`+ Added: ${artist.name.ko}`);
    } else {
      console.log(`- Skipped: ${artist.name.ko} (Already exists)`);
    }
  }

  console.log(`Seed complete. Added ${added} new artists.`);
  process.exit(0);
}

seedDatabase();
