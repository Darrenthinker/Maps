import fs from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";

const converter = OpenCC.Converter({ from: "tw", to: "cn" });
const ROOT = process.cwd();
const PORTS_PATH = path.join(ROOT, "public", "data", "ports-classified.json");

const WIKI_API = "https://zh.wikipedia.org/w/api.php";

async function fetchWikiPage(title) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    format: "json",
    origin: "*"
  });
  
  const response = await fetch(`${WIKI_API}?${params}`);
  const data = await response.json();
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.revisions?.[0]?.["*"] || "";
}

// 从维基百科"港口列表"页面解析数据
async function parsePortListPage() {
  console.log("Fetching 港口列表...");
  const content = await fetchWikiPage("港口列表");
  
  const portMap = new Map();
  
  // 匹配 [[港口名|显示名]] 或 [[港口名]] 格式
  const linkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;
  
  while ((match = linkPattern.exec(content)) !== null) {
    let name = match[2] || match[1];
    // 清理名称
    name = name.replace(/港$/, "").trim();
    if (name.length >= 2 && name.length <= 20) {
      // 繁体转简体
      name = converter(name);
      portMap.set(name, name);
    }
  }
  
  return portMap;
}

// 从维基百科获取各国港口列表
async function fetchCountryPortPages() {
  const pages = [
    "中华人民共和国港口列表",
    "港口列表",
    "世界貨櫃吞吐量最大港口列表",
    "中华人民共和国吞吐量最大港口列表"
  ];
  
  const portMap = new Map();
  
  for (const pageName of pages) {
    console.log(`Fetching ${pageName}...`);
    const content = await fetchWikiPage(pageName);
    if (!content) {
      console.log(`  Page not found`);
      continue;
    }
    
    // 提取 [[港口名]] 链接
    const linkPattern = /\[\[([^\]|]+港?)(?:\|([^\]]+))?\]\]/g;
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      let name = match[2] || match[1];
      // 清理名称，保留港字
      name = name.trim();
      if (name.length >= 2 && name.length <= 30 && !name.includes(":")) {
        name = converter(name);
        // 生成不带"港"的版本
        const baseName = name.replace(/港$/, "");
        if (baseName.length >= 2) {
          portMap.set(baseName, name.endsWith("港") ? name : baseName);
        }
      }
    }
    
    console.log(`  Found ${portMap.size} port names so far`);
  }
  
  return portMap;
}

// 更新港口数据
function updatePortsWithWikiData(portsData, wikiPortMap) {
  let updated = 0;
  let total = 0;
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          total += 1;
          
          // 如果已有中文名，跳过
          if (port.nameZh) continue;
          
          // 尝试匹配城市名或港口名
          const cityName = port.city || "";
          const portName = port.name || "";
          
          // 尝试多种匹配方式
          let zh = null;
          
          // 1. 直接匹配城市名
          if (wikiPortMap.has(cityName)) {
            zh = wikiPortMap.get(cityName);
          }
          // 2. 匹配城市名+港
          else if (wikiPortMap.has(cityName + "港")) {
            zh = wikiPortMap.get(cityName + "港");
          }
          // 3. 匹配港口名
          else if (wikiPortMap.has(portName)) {
            zh = wikiPortMap.get(portName);
          }
          // 4. 匹配港口名+港
          else if (wikiPortMap.has(portName + "港")) {
            zh = wikiPortMap.get(portName + "港");
          }
          
          if (zh) {
            port.nameZh = zh;
            updated += 1;
          }
        }
      }
    }
  }
  
  return { total, updated };
}

// 从Wikidata获取更多港口名称（使用城市信息）
async function fetchPortsFromWikidata() {
  console.log("\nFetching port data from Wikidata with city info...");
  
  const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
  
  // 查询所有有UN/LOCODE的地点，获取中文名和城市名
  const query = `
    SELECT ?locode ?zhLabel ?cityLabel WHERE {
      ?item wdt:P1937 ?locode.
      OPTIONAL { ?item rdfs:label ?zhcn FILTER(LANG(?zhcn) = "zh-cn") }
      OPTIONAL { ?item rdfs:label ?zhhans FILTER(LANG(?zhhans) = "zh-hans") }
      OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
      BIND(COALESCE(?zhcn, ?zhhans, ?zh) AS ?zhLabel)
      OPTIONAL { ?item wdt:P131 ?city. ?city rdfs:label ?cityLabel FILTER(LANG(?cityLabel) = "zh") }
      FILTER(BOUND(?zhLabel))
    }
    LIMIT 50000
  `;
  
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "GlobalHubMap/1.0" }
  });
  
  if (!response.ok) {
    console.log("Wikidata query failed");
    return new Map();
  }
  
  const data = await response.json();
  const bindings = data?.results?.bindings || [];
  
  const map = new Map();
  for (const row of bindings) {
    let zh = row.zhLabel?.value?.trim();
    if (!zh) continue;
    zh = converter(zh);
    const locode = (row.locode?.value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (locode) {
      map.set(locode, zh);
    }
  }
  
  console.log(`Loaded ${map.size} port names from Wikidata`);
  return map;
}

// 直接更新港口数据
function updatePortsWithLocode(portsData, locodeMap) {
  let updated = 0;
  let total = 0;
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          total += 1;
          if (port.nameZh) continue;
          
          const code = (port.code || "").toUpperCase();
          const zh = locodeMap.get(code);
          if (zh) {
            port.nameZh = zh;
            updated += 1;
          }
        }
      }
    }
  }
  
  return { total, updated };
}

async function main() {
  if (!fs.existsSync(PORTS_PATH)) {
    throw new Error(`Missing file: ${PORTS_PATH}`);
  }
  
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));
  
  // 1. 从Wikidata获取数据
  const wikidataMap = await fetchPortsFromWikidata();
  const result1 = updatePortsWithLocode(portsData, wikidataMap);
  console.log(`Updated from Wikidata: ${result1.updated}`);
  
  // 2. 从维基百科页面获取港口名
  const wikiPortMap = await fetchCountryPortPages();
  console.log(`\nTotal wiki port names: ${wikiPortMap.size}`);
  
  const result2 = updatePortsWithWikiData(portsData, wikiPortMap);
  console.log(`Updated from Wikipedia pages: ${result2.updated}`);
  
  // 保存
  fs.writeFileSync(PORTS_PATH, JSON.stringify(portsData, null, 2));
  
  // 统计最终结果
  let withZh = 0;
  let withoutZh = 0;
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          if (port.nameZh) withZh++;
          else withoutZh++;
        }
      }
    }
  }
  
  console.log(`\n=== Final Statistics ===`);
  console.log(`Ports with Chinese name: ${withZh}`);
  console.log(`Ports without Chinese name: ${withoutZh}`);
  console.log(`Coverage: ${(withZh / (withZh + withoutZh) * 100).toFixed(1)}%`);
}

main().catch(console.error);
