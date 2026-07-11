const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const Parser = require("rss-parser");
const { GoogleGenAI, Type, Schema } = require("@google/genai");

admin.initializeApp();
const db = admin.firestore();
const parser = new Parser();

// Use Gemini to extract structured comeback data from raw text
const ai = new GoogleGenAI({}); // Relies on GEMINI_API_KEY env var

const comebackSchema = {
  type: Type.ARRAY,
  description: "A list of K-pop idol comebacks found in the text.",
  items: {
    type: Type.OBJECT,
    properties: {
      teamName: { type: Type.STRING },
      date: { type: Type.STRING, description: "YYYY-MM-DD format" },
      albumType: { type: Type.STRING, description: "Single, EP, Mini Album, Full Album, etc." },
      titleTrack: { type: Type.STRING },
    },
    required: ["teamName", "date"],
  },
};

exports.scraper = onSchedule("every day 00:00", async (event) => {
  console.log("Running daily idol comeback scraper...");

  try {
    // Example RSS feed (Google News for K-pop comeback)
    const feed = await parser.parseURL("https://news.google.com/rss/search?q=kpop+comeback+announce&hl=en-US&gl=US&ceid=US:en");
    
    // Process the top 5 articles
    const articles = feed.items.slice(0, 5);
    
    for (const article of articles) {
      console.log(`Processing article: ${article.title}`);
      
      const prompt = `
        Extract any K-pop idol comeback announcements from the following news text.
        News Title: ${article.title}
        News Snippet: ${article.contentSnippet || article.content}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: comebackSchema,
        },
      });

      const extractedData = JSON.parse(response.text);

      for (const comeback of extractedData) {
        if (!comeback.teamName || !comeback.date) continue;
        
        const docId = `${comeback.teamName}-${comeback.date}`.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        
        await db.collection("comebacks").doc(docId).set({
          teamName: comeback.teamName,
          date: admin.firestore.Timestamp.fromDate(new Date(comeback.date)),
          albumType: comeback.albumType || "Unknown",
          titleTrack: comeback.titleTrack || "",
          sources: admin.firestore.FieldValue.arrayUnion(article.link),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        console.log(`Saved comeback for ${comeback.teamName} on ${comeback.date}`);
      }
    }
  } catch (error) {
    console.error("Scraper failed:", error);
  }
});
