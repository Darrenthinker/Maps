import fs from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";

// 繁体转简体转换器
const converter = OpenCC.Converter({ from: "tw", to: "cn" });

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const AIRPORTS_PATH = path.join(DATA_DIR, "airports-classified.json");
const PORTS_PATH = path.join(DATA_DIR, "ports-classified.json");

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "GlobalHubMap/1.0 (contact: local-script)";

async function runSparql(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT
    }
  });
  if (!response.ok) {
    throw new Error(`SPARQL request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchPaged(queryBuilder, pageSize = 2000) {
  let offset = 0;
  const rows = [];
  while (true) {
    const query = queryBuilder(pageSize, offset);
    const data = await runSparql(query);
    const bindings = data?.results?.bindings || [];
    if (bindings.length === 0) break;
    rows.push(...bindings);
    offset += pageSize;
    if (bindings.length < pageSize) break;
  }
  return rows;
}

function normalizeCode(value) {
  return (value || "").trim().toUpperCase();
}

function buildAirportNameMap(rows) {
  const map = new Map();
  for (const row of rows) {
    let zh = row.zhLabel?.value?.trim();
    if (!zh) continue;
    // 繁体转简体
    zh = converter(zh);
    const iata = normalizeCode(row.iata?.value);
    const icao = normalizeCode(row.icao?.value);
    if (iata) map.set(iata, zh);
    if (icao && !map.has(icao)) map.set(icao, zh);
  }
  return map;
}

function buildPortNameMap(rows) {
  const map = new Map();
  for (const row of rows) {
    let zh = row.zhLabel?.value?.trim();
    if (!zh) continue;
    // 繁体转简体
    zh = converter(zh);
    const locode = normalizeCode(row.locode?.value);
    if (!locode) continue;
    const normalized = locode.replace(/\s+/g, "");
    map.set(normalized, zh);
  }
  return map;
}

function updateAirports(airportsData, nameMap) {
  let updated = 0;
  let total = 0;
  for (const continent of Object.values(airportsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const airport of country.airports || []) {
          total += 1;
          const code = normalizeCode(airport.code || airport.iata || airport.icao);
          const zh = nameMap.get(code);
          if (zh && airport.nameZh !== zh) {
            airport.nameZh = zh;
            updated += 1;
          }
        }
      }
    }
  }
  return { total, updated };
}

function updatePorts(portsData, nameMap, cityNames = {}, localPortNames = {}) {
  let updated = 0;
  let total = 0;
  let fromWikidata = 0;
  let fromLocalPort = 0;
  let fromCity = 0;
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          total += 1;
          const code = normalizeCode(port.code);
          
          // 如果已有中文名，跳过
          if (port.nameZh) continue;
          
          // 1. 首先尝试Wikidata
          let zh = nameMap.get(code);
          if (zh) {
            port.nameZh = zh;
            updated += 1;
            fromWikidata += 1;
            continue;
          }
          
          // 2. 尝试本地港口名称映射
          zh = localPortNames[code];
          if (zh) {
            port.nameZh = zh;
            updated += 1;
            fromLocalPort += 1;
            continue;
          }
          
          // 3. 尝试城市名翻译
          const cityName = port.city || port.name;
          if (cityName) {
            // 尝试直接匹配
            zh = cityNames[cityName];
            if (!zh) {
              // 尝试不区分大小写匹配
              const cityKey = Object.keys(cityNames).find(
                k => k.toLowerCase() === cityName.toLowerCase()
              );
              if (cityKey) zh = cityNames[cityKey];
            }
            if (zh) {
              port.nameZh = zh;
              updated += 1;
              fromCity += 1;
            }
          }
        }
      }
    }
  }
  return { total, updated, fromWikidata, fromLocalPort, fromCity };
}

async function main() {
  if (!fs.existsSync(AIRPORTS_PATH)) {
    throw new Error(`Missing file: ${AIRPORTS_PATH}`);
  }
  if (!fs.existsSync(PORTS_PATH)) {
    throw new Error(`Missing file: ${PORTS_PATH}`);
  }

  // 使用 zh-cn 获取简体中文，如果没有则尝试 zh-hans，最后尝试 zh
  console.log("Fetching airport names from Wikidata (简体中文)...");
  const airportRows = await fetchPaged((limit, offset) => `
    SELECT ?iata ?icao ?zhLabel WHERE {
      ?item wdt:P31/wdt:P279* wd:Q1248784.
      OPTIONAL { ?item wdt:P238 ?iata. }
      OPTIONAL { ?item wdt:P239 ?icao. }
      OPTIONAL { ?item rdfs:label ?zhcn FILTER(LANG(?zhcn) = "zh-cn") }
      OPTIONAL { ?item rdfs:label ?zhhans FILTER(LANG(?zhhans) = "zh-hans") }
      OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
      BIND(COALESCE(?zhcn, ?zhhans, ?zh) AS ?zhLabel)
      FILTER(BOUND(?zhLabel))
      FILTER(BOUND(?iata) || BOUND(?icao))
    }
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  const airportNameMap = buildAirportNameMap(airportRows);
  console.log(`Airport names loaded: ${airportNameMap.size}`);

  console.log("Fetching port names from Wikidata (简体中文)...");
  // 查询多种港口类型：海港(Q44782)、港口(Q283202)、港口城市(Q515)
  const portRows = await fetchPaged((limit, offset) => `
    SELECT ?locode ?zhLabel WHERE {
      {
        ?item wdt:P31/wdt:P279* wd:Q44782.
        ?item wdt:P1937 ?locode.
      } UNION {
        ?item wdt:P31/wdt:P279* wd:Q283202.
        ?item wdt:P1937 ?locode.
      } UNION {
        ?item wdt:P1937 ?locode.
      }
      OPTIONAL { ?item rdfs:label ?zhcn FILTER(LANG(?zhcn) = "zh-cn") }
      OPTIONAL { ?item rdfs:label ?zhhans FILTER(LANG(?zhhans) = "zh-hans") }
      OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
      BIND(COALESCE(?zhcn, ?zhhans, ?zh) AS ?zhLabel)
      FILTER(BOUND(?zhLabel))
    }
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  const portNameMap = buildPortNameMap(portRows);
  console.log(`Port names loaded from Wikidata: ${portNameMap.size}`);
  
  // 加载城市名翻译作为补充
  const cityNamesPath = path.join(ROOT, "data", "raw", "city-names-zh.json");
  let cityNames = {};
  let portNames = {};
  if (fs.existsSync(cityNamesPath)) {
    const cityData = JSON.parse(fs.readFileSync(cityNamesPath, "utf8"));
    cityNames = cityData.cities || {};
    portNames = cityData.ports || {};
    console.log(`City names loaded: ${Object.keys(cityNames).length}`);
    console.log(`Port names from local: ${Object.keys(portNames).length}`);
  }

  const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));

  const airportResult = updateAirports(airportsData, airportNameMap);
  const portResult = updatePorts(portsData, portNameMap, cityNames, portNames);

  fs.writeFileSync(AIRPORTS_PATH, JSON.stringify(airportsData, null, 2));
  fs.writeFileSync(PORTS_PATH, JSON.stringify(portsData, null, 2));

  console.log(`Airports updated: ${airportResult.updated}/${airportResult.total}`);
  console.log(`Ports updated: ${portResult.updated}/${portResult.total}`);
  console.log(`  - From Wikidata: ${portResult.fromWikidata}`);
  console.log(`  - From local port names: ${portResult.fromLocalPort}`);
  console.log(`  - From city names: ${portResult.fromCity}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
