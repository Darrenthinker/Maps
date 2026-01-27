import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AIRPORTS_PATH = path.join(ROOT, "public", "data", "airports-classified.json");

const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));

let withZh = 0;
let withoutZh = 0;
const missingExamples = [];

for (const continent of Object.values(airportsData.continents || {})) {
  for (const region of Object.values(continent.regions || {})) {
    for (const country of Object.values(region.countries || {})) {
      for (const airport of country.airports || []) {
        if (airport.nameZh) {
          withZh++;
        } else {
          withoutZh++;
          if (missingExamples.length < 20) {
            missingExamples.push(`${airport.code} - ${airport.name} (${airport.city})`);
          }
        }
      }
    }
  }
}

console.log("=== Airport Chinese Name Coverage ===");
console.log(`With Chinese name: ${withZh}`);
console.log(`Without Chinese name: ${withoutZh}`);
console.log(`Coverage: ${(withZh / (withZh + withoutZh) * 100).toFixed(1)}%`);

if (missingExamples.length > 0) {
  console.log("\nExamples without Chinese name:");
  for (const ex of missingExamples) {
    console.log(`  ${ex}`);
  }
}
