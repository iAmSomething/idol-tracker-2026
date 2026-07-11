async function run() {
  const query = "LE SSERAFIM";
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'IdolTracker/1.0.0 ( test@example.com )' }});
    const data = await res.json();
    
    if (data.artists && data.artists.length > 0) {
      const artist = data.artists[0];
      console.log(`Found artist: ${artist.name} (ID: ${artist.id})`);
      
      // Fetch URL relationships
      const relUrl = `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`;
      const relRes = await fetch(relUrl, { headers: { 'User-Agent': 'IdolTracker/1.0.0 ( test@example.com )' }});
      const relData = await relRes.json();
      
      const urls = relData.relations.map(r => r.url.resource);
      console.log("URLs:", urls);
    } else {
      console.log("Artist not found");
    }
  } catch (e) {
    console.error(e);
  }
}
run();
