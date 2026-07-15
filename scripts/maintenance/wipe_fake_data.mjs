import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";

// Load config
const configPath = new URL("../app/firebase.ts", import.meta.url).pathname;
const firebaseTsContent = readFileSync(configPath, "utf-8");

// Extract config using regex
const apiKeyMatch = firebaseTsContent.match(/apiKey:\s*"([^"]+)"/);
const projectIdMatch = firebaseTsContent.match(/projectId:\s*"([^"]+)"/);

if (!apiKeyMatch || !projectIdMatch) {
  console.error("Could not extract Firebase config from app/firebase.ts");
  process.exit(1);
}

const firebaseConfig = {
  apiKey: apiKeyMatch[1],
  projectId: projectIdMatch[1],
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipeData() {
  console.log("Fetching all documents in 'comebacks' collection...");
  const snapshot = await getDocs(collection(db, "comebacks"));
  
  if (snapshot.empty) {
    console.log("Collection is already empty.");
    process.exit(0);
  }

  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "comebacks", document.id));
    count++;
  }
  
  console.log(`Successfully deleted ${count} fake comebacks.`);
  process.exit(0);
}

wipeData().catch(console.error);
