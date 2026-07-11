import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./artists_full.json', 'utf8'));

const hybeLabels = ["BIGHIT MUSIC", "ADOR", "Source Music", "PLEDIS Entertainment", "BELIFT LAB", "KOZ Entertainment"];
const kakaoLabels = ["Starship Entertainment", "IST Entertainment", "EDAM Entertainment", "High Up Entertainment", "Antenna"];

const updatedData = data.map(artist => {
  const agencyName = artist.agency?.name;
  let parentName = undefined;

  if (agencyName) {
    const normalizedAgency = agencyName.trim();
    if (hybeLabels.includes(normalizedAgency)) {
      parentName = "HYBE";
    } else if (kakaoLabels.includes(normalizedAgency)) {
      parentName = "Kakao Entertainment";
    }
  }

  if (parentName) {
    artist.agency.parentName = parentName;
  }
  
  return artist;
});

fs.writeFileSync('./artists_full.json', JSON.stringify(updatedData, null, 2));
console.log("Updated artists_full.json with parent agencies.");
