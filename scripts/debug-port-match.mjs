import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORTS_PATH = path.join(ROOT, "public", "data", "ports-classified.json");
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "GlobalHubMap/1.0 (contact: local-script)";

async function runSparql(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!response.ok) {
    throw new Error(`SPARQL request failed: ${response.status}`);
  }
  return response.json();
}

async function main() {
  // 获取一些样本数据
  console.log("Fetching sample port data from Wikidata...");
  const query = `
    SELECT ?locode ?zhLabel WHERE {
      ?item wdt:P1937 ?locode.
      OPTIONAL { ?item rdfs:label ?zhcn FILTER(LANG(?zhcn) = "zh-cn") }
      OPTIONAL { ?item rdfs:label ?zhhans FILTER(LANG(?zhhans) = "zh-hans") }
      OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
      BIND(COALESCE(?zhcn, ?zhhans, ?zh) AS ?zhLabel)
      FILTER(BOUND(?zhLabel))
    }
    LIMIT 50
  `;
  
  const data = await runSparql(query);
  const bindings = data?.results?.bindings || [];
  
  console.log("\nWikidata locode samples:");
  for (const row of bindings.slice(0, 20)) {
    const locode = row.locode?.value || "";
    const zh = row.zhLabel?.value || "";
    console.log(`  "${locode}" -> "${zh}"`);
  }
  
  // 加载我们的港口数据
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));
  const ourCodes = new Set();
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          ourCodes.add(port.code);
        }
      }
    }
  }
  
  console.log("\nOur port code samples:");
  const samples = [...ourCodes].slice(0, 20);
  for (const code of samples) {
    console.log(`  "${code}"`);
  }
  
  // 检查格式差异
  console.log("\n--- Format Analysis ---");
  const wikiCodes = bindings.map(r => r.locode?.value || "");
  console.log("Wikidata format example:", wikiCodes[0]);
  console.log("Our format example:", samples[0]);
  
  // 尝试不同的匹配方式
  let matchCount = 0;
  for (const row of bindings) {
    const wikiCode = (row.locode?.value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (ourCodes.has(wikiCode)) {
      matchCount++;
    }
  }
  console.log(`\nMatched ${matchCount} out of ${bindings.length} sample codes`);
}

main().catch(console.error);
