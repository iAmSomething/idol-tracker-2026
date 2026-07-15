import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "idol-tracker-2026" });
const db = getFirestore(app);

async function forceInsert() {
  const comebacks = [
    { artistName: "아이덴티티", title: "잇츠낫오버", releaseDate: "2026-07-13", releaseType: "mini" },
    { artistName: "디렉션(D:D)", title: "MONKEY MODE", releaseDate: "2026-07-13", releaseType: "single" },
    { artistName: "WOOAH", title: "Wish With W: Vol.3", releaseDate: "2026-07-13", releaseType: "single" },
    { artistName: "손준형", title: "CRUSH", releaseDate: "2026-07-13", releaseType: "single" },
    { artistName: "영파씨", title: "young tape", releaseDate: "2026-07-13", releaseType: "single" } // 스페셜 -> single로 통일
  ];

  for (const c of comebacks) {
    const id = `${c.artistName}_${c.releaseDate}`;
    await setDoc(doc(db, "comebacks", id), {
      ...c,
      isReleased: true, // Already past
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log(`Inserted ${id}`);
  }
}
forceInsert();
