/**
 * 从已翻译的数据中提取中文名，保存为静态映射文件
 * 这样以后分类脚本可以直接引用，不需要重新翻译
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

const AIRPORTS_PATH = path.join(DATA_DIR, "airports-classified.json");
const PORTS_PATH = path.join(DATA_DIR, "ports-classified.json");

// 输出的静态映射文件
const AIRPORT_NAMES_ZH_PATH = path.join(RAW_DIR, "airport-names-zh.json");
const PORT_NAMES_ZH_PATH = path.join(RAW_DIR, "port-names-zh.json");

function extractAirportNames() {
  const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));
  const namesMap = {};
  let count = 0;
  
  for (const continent of Object.values(airportsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const airport of country.airports || []) {
          if (airport.nameZh && airport.code) {
            namesMap[airport.code] = airport.nameZh;
            count++;
          }
        }
      }
    }
  }
  
  return { namesMap, count };
}

function extractPortNames() {
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));
  const namesMap = {};
  let count = 0;
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          if (port.nameZh && port.code) {
            namesMap[port.code] = port.nameZh;
            count++;
          }
        }
      }
    }
  }
  
  return { namesMap, count };
}

function main() {
  console.log("提取机场中文名...");
  const airportResult = extractAirportNames();
  
  const airportData = {
    description: "机场代码到中文名的静态映射表",
    lastUpdated: new Date().toISOString().split("T")[0],
    totalCount: airportResult.count,
    names: airportResult.namesMap
  };
  
  fs.writeFileSync(AIRPORT_NAMES_ZH_PATH, JSON.stringify(airportData, null, 2));
  console.log(`✅ 保存 ${airportResult.count} 个机场中文名到 ${AIRPORT_NAMES_ZH_PATH}`);
  
  console.log("\n提取港口中文名...");
  const portResult = extractPortNames();
  
  const portData = {
    description: "港口代码到中文名的静态映射表",
    lastUpdated: new Date().toISOString().split("T")[0],
    totalCount: portResult.count,
    names: portResult.namesMap
  };
  
  fs.writeFileSync(PORT_NAMES_ZH_PATH, JSON.stringify(portData, null, 2));
  console.log(`✅ 保存 ${portResult.count} 个港口中文名到 ${PORT_NAMES_ZH_PATH}`);
}

main();
