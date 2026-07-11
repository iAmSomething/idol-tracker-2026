import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com",
  messagingSenderId: "47996752520"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const comebacks = [
  {
    artistName: "연준 (TXT)",
    title: "NO LABELS: PART 02",
    releaseDate: new Date("2026-07-10T09:00:00Z"),
    releaseType: "mini",
    agencyName: "BIGHIT MUSIC",
    imageUrl: "https://images.unsplash.com/photo-1549849171-03f601f06d03?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "재현 (NCT)",
    title: "JAEHYUN 1st Album",
    releaseDate: new Date("2026-07-10T09:00:00Z"),
    releaseType: "full",
    agencyName: "SM Entertainment",
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "슈퍼주니어-83z",
    title: "Promise",
    releaseDate: new Date("2026-07-13T09:00:00Z"),
    releaseType: "mini",
    agencyName: "SM Entertainment",
    imageUrl: "https://images.unsplash.com/photo-1621360841013-c76831f1628c?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "NCT WISH",
    title: "YO-I-DON! / BOY MEETS GIRL",
    releaseDate: new Date("2026-07-13T09:00:00Z"),
    releaseType: "single",
    agencyName: "SM Entertainment",
    imageUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "허타 (HUTA)",
    title: "TEMPERATURE",
    releaseDate: new Date("2026-07-15T09:00:00Z"),
    releaseType: "single",
    agencyName: "BTOB COMPANY",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "선미 (SUNMI)",
    title: "Forever July",
    releaseDate: new Date("2026-07-15T09:00:00Z"),
    releaseType: "single",
    agencyName: "ABYSS COMPANY",
    imageUrl: "https://images.unsplash.com/photo-1601646654215-d91ab2d5d8fb?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "브브걸 (BBGIRLS)",
    title: "BODY WAVE",
    releaseDate: new Date("2026-07-16T09:00:00Z"),
    releaseType: "single",
    agencyName: "GLND",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=200&auto=format&fit=crop"
  },
  {
    artistName: "레드벨벳 (Red Velvet)",
    title: "Summer Magic V2",
    releaseDate: new Date("2026-07-31T09:00:00Z"),
    releaseType: "mini",
    agencyName: "SM Entertainment",
    imageUrl: "https://images.unsplash.com/photo-1520697830682-8980b1c1d06e?q=80&w=200&auto=format&fit=crop"
  }
];

async function runSeed() {
  console.log("Starting Real Data Seed...");

  for (const cb of comebacks) {
    console.log(`Processing: ${cb.artistName} - ${cb.title}`);
    
    // 1. Create Comeback doc
    const cbData = {
      artistName: cb.artistName,
      title: cb.title,
      releaseDate: cb.releaseDate,
      releaseType: cb.releaseType,
      agencyName: cb.agencyName,
      imageUrl: cb.imageUrl,
      createdAt: new Date(),
    };
    await addDoc(collection(db, "comebacks"), cbData);

    // 2. Find or Create Artist doc
    const q = query(collection(db, "artists"), where("name", "==", cb.artistName));
    const artistSnap = await getDocs(q);
    
    const recentComebackPayload = {
      title: cb.title,
      date: cb.releaseDate,
      type: cb.releaseType
    };

    if (!artistSnap.empty) {
      // Update existing
      const artistDoc = artistSnap.docs[0];
      await updateDoc(doc(db, "artists", artistDoc.id), {
        recentComeback: recentComebackPayload,
        agencyId: cb.agencyName.toLowerCase().replace(/\s/g, '_')
      });
      console.log(`  -> Updated existing artist: ${cb.artistName}`);
    } else {
      // Create new
      await addDoc(collection(db, "artists"), {
        name: cb.artistName,
        agencyId: cb.agencyName.toLowerCase().replace(/\s/g, '_'),
        debutDate: new Date(), // Dummy debut date for now
        isActive: true,
        recentComeback: recentComebackPayload,
        imageUrl: cb.imageUrl
      });
      console.log(`  -> Created new artist: ${cb.artistName}`);
    }
  }

  console.log("Seed completed successfully!");
  process.exit(0);
}

runSeed().catch(console.error);
