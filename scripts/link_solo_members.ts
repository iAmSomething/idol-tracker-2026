import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Initialize Firebase Admin
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

async function linkSoloMembers() {
  console.log("🚀 Starting Group ↔ Solo cross-mapping...");
  
  const artistsSnapshot = await getDocs(collection(db, "artists"));
  
  // 1. Build a map of all solo artists
  const soloArtists = new Map<string, {id: string, name: string}>();
  const allArtists: any[] = [];
  
  artistsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    allArtists.push({ id: doc.id, ...data });
    
    // Check if solo or has no parent group (often soloists just have type="solo")
    if (data.type === "solo") {
      soloArtists.set(data.name.ko, { id: doc.id, name: data.name.ko });
      if (data.name.en) {
        soloArtists.set(data.name.en, { id: doc.id, name: data.name.ko });
      }
      (data.name.aliases || []).forEach((alias: string) => {
         soloArtists.set(alias, { id: doc.id, name: data.name.ko });
      });
    }
  });

  console.log(`Found ${soloArtists.size} solo identifiers in DB.`);
  
  // 2. Iterate groups and map members
  let batch = writeBatch(db);
  let updateCount = 0;
  
  for (const group of allArtists) {
    if (group.type === "group" && Array.isArray(group.members) && group.members.length > 0) {
      let isModified = false;
      const updatedMembers = group.members.map((member: any) => {
        // Handle migration from string[] to object[]
        const memberName = typeof member === "string" ? member : member.name;
        const currentId = typeof member === "object" ? member.artistId : undefined;
        
        // Search solo list
        let matchedArtistId = currentId;
        if (!matchedArtistId && soloArtists.has(memberName)) {
           matchedArtistId = soloArtists.get(memberName)!.id;
           isModified = true;
           console.log(`  🔗 Mapped ${memberName} in ${group.name.ko} to Solo Artist ID: ${matchedArtistId}`);
        }
        
        return {
          name: memberName,
          ...(matchedArtistId ? { artistId: matchedArtistId } : {})
        };
      });
      
      // We must always update if it was string[] originally
      const wasStringArray = typeof group.members[0] === "string";
      if (isModified || wasStringArray) {
        batch.update(doc(db, "artists", group.id), {
          members: updatedMembers
        });
        updateCount++;
        
        if (updateCount % 400 === 0) {
           await batch.commit();
           batch = writeBatch(db);
           console.log(`... Committed ${updateCount} links ...`);
        }
      }
    }
  }

  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Success! Updated ${updateCount} group documents with cross-mapped member links.`);
  } else {
    console.log(`✅ Finished. No groups needed updating.`);
  }
}

linkSoloMembers().catch(console.error);
