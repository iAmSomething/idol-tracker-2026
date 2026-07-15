import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = { projectId: "idol-tracker-2026" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "comebacks"), where("artistName", "==", "세븐틴"));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
      const data = d.data();
      console.log("ID:", d.id);
      console.log("Title:", data.title);
      console.log("Date:", data.releaseDate);
      console.log("RecentNews:", JSON.stringify(data.recentNews, null, 2));
      console.log("SourceTitle:", data.sourceTitle);
      console.log("---");
  });
}
run().catch(console.error);
