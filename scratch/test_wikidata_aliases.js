const name = "aespa";
const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json`;

async function run() {
  try {
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (!data.search || data.search.length === 0) {
      console.log("No results");
      return;
    }
    const entityId = data.search[0].id;
    console.log(`Found entity: ${entityId}`);
    
    const getUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=labels|aliases&languages=ko|en&format=json`;
    const res2 = await fetch(getUrl);
    const data2 = await res2.json();
    const entity = data2.entities[entityId];
    
    const nameKo = entity.labels?.ko?.value || null;
    const nameEn = entity.labels?.en?.value || null;
    
    const aliasesKo = (entity.aliases?.ko || []).map(a => a.value);
    const aliasesEn = (entity.aliases?.en || []).map(a => a.value);
    
    console.log("Labels:", { ko: nameKo, en: nameEn });
    console.log("Aliases KO:", aliasesKo);
    console.log("Aliases EN:", aliasesEn);
  } catch (e) {
    console.error(e);
  }
}
run();
