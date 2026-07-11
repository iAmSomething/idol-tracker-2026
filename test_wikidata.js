async function run() {
  const query = "LE SSERAFIM";
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const id = data.search[0]?.id;
  if (!id) return console.log("Not found");
  
  const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${id}&format=json`;
  const entityRes = await fetch(entityUrl);
  const entityData = await entityRes.json();
  const claims = entityData.claims;
  
  const twitter = claims['P2002']?.[0]?.mainsnak?.datavalue?.value;
  const instagram = claims['P2003']?.[0]?.mainsnak?.datavalue?.value;
  const tiktok = claims['P4003']?.[0]?.mainsnak?.datavalue?.value;
  
  console.log({ twitter, instagram, tiktok });
}
run();
