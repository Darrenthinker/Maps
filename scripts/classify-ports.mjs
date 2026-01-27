/**
 * 按大洲/区域/国家分类港口数据
 * 输出结构化的港口分类 JSON
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

const PORTS_JSON = path.join(DATA_DIR, "ports.json");
const WORLD_REGIONS_JSON = path.join(RAW_DIR, "world-regions.json");

// 港澳台排序权重（排在中国后面）
const CHINA_REGION_ORDER = { CN: 0, HK: 1, MO: 2, TW: 3 };

// 加载世界区域分类
function loadWorldRegions() {
  const data = JSON.parse(fs.readFileSync(WORLD_REGIONS_JSON, "utf8"));
  
  // 建立国家代码到大洲/区域的映射
  const countryToContinent = {};
  const countryToRegion = {};
  const countryInfo = {};
  
  for (const [contCode, continent] of Object.entries(data.continents)) {
    for (const [regCode, region] of Object.entries(continent.regions)) {
      for (const [countryCode, country] of Object.entries(region.countries)) {
        countryToContinent[countryCode] = contCode;
        countryToRegion[countryCode] = regCode;
        countryInfo[countryCode] = {
          name: country.name,
          nameEn: country.nameEn,
          continent: contCode,
          continentName: continent.name,
          continentNameEn: continent.nameEn,
          region: regCode,
          regionName: region.name,
          regionNameEn: region.nameEn
        };
      }
    }
  }
  
  return { data, countryToContinent, countryToRegion, countryInfo };
}

// 从 country 字段提取国家代码（如 "AE 阿联酋" -> "AE"）
function extractCountryCode(countryField) {
  if (!countryField) return null;
  const match = countryField.match(/^([A-Z]{2})/);
  return match ? match[1] : null;
}

// 处理单个大洲的港口
function processContinent(continentCode, ports, worldRegions) {
  const { data, countryToContinent, countryToRegion, countryInfo } = worldRegions;
  const continent = data.continents[continentCode];
  
  if (!continent) {
    return null;
  }
  
  // 筛选该大洲的港口
  const continentPorts = ports.filter(p => {
    const cc = extractCountryCode(p.country);
    return countryToContinent[cc] === continentCode;
  });
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`大洲: ${continent.name} (${continent.nameEn}) - ${continentCode}`);
  console.log(`港口总数: ${continentPorts.length}`);
  console.log(`${"=".repeat(60)}`);
  
  // 按区域和国家分类
  const result = {
    code: continentCode,
    name: continent.name,
    nameEn: continent.nameEn,
    totalPorts: continentPorts.length,
    regions: {}
  };
  
  for (const [regCode, region] of Object.entries(continent.regions)) {
    const regionPorts = continentPorts.filter(p => {
      const cc = extractCountryCode(p.country);
      return countryToRegion[cc] === regCode;
    });
    
    if (regionPorts.length === 0) continue;
    
    console.log(`\n  区域: ${region.name} (${regCode})`);
    
    const regionResult = {
      code: regCode,
      name: region.name,
      nameEn: region.nameEn,
      totalPorts: regionPorts.length,
      countries: {}
    };
    
    // 按国家分类
    const countryGroups = {};
    for (const port of regionPorts) {
      const cc = extractCountryCode(port.country);
      if (!countryGroups[cc]) {
        countryGroups[cc] = [];
      }
      countryGroups[cc].push(port);
    }
    
    // 按港口数量排序国家，但港澳台特殊处理（排在中国后面）
    const sortedCountries = Object.entries(countryGroups).sort((a, b) => {
      const aCode = a[0];
      const bCode = b[0];
      const aOrder = CHINA_REGION_ORDER[aCode];
      const bOrder = CHINA_REGION_ORDER[bCode];
      
      // 如果都是中国相关地区，按指定顺序排
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }
      // 如果只有一个是中国相关地区，中国相关排前面
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      // 其他国家按数量排序
      return b[1].length - a[1].length;
    });
    
    for (const [countryCode, countryPorts] of sortedCountries) {
      const info = countryInfo[countryCode] || { name: countryCode, nameEn: countryCode };
      
      const portList = countryPorts.map(p => ({
        code: p.code,
        name: p.name,
        city: p.city,
        lat: p.lat,
        lng: p.lng
      }));
      
      // 按港口代码排序
      portList.sort((a, b) => a.code.localeCompare(b.code));
      
      regionResult.countries[countryCode] = {
        code: countryCode,
        name: info.name,
        nameEn: info.nameEn,
        totalPorts: countryPorts.length,
        ports: portList
      };
      
      console.log(`    ${info.name} (${countryCode}): ${countryPorts.length} 港口`);
    }
    
    result.regions[regCode] = regionResult;
  }
  
  return result;
}

function main() {
  console.log("开始分类港口数据...\n");
  
  // 加载数据
  const worldRegions = loadWorldRegions();
  
  // 读取港口数据
  const ports = JSON.parse(fs.readFileSync(PORTS_JSON, "utf8"));
  console.log(`共加载 ${ports.length} 个港口`);
  
  // 统计各大洲港口
  const continentOrder = ["AS", "EU", "NA", "SA", "AF", "OC"];
  const continentNames = {
    AS: "亚洲", EU: "欧洲", NA: "北美洲", SA: "南美洲", AF: "非洲", OC: "大洋洲"
  };
  
  // 统计每个大洲的港口数
  const continentStats = {};
  for (const port of ports) {
    const cc = extractCountryCode(port.country);
    const cont = worldRegions.countryToContinent[cc];
    if (cont) {
      continentStats[cont] = (continentStats[cont] || 0) + 1;
    }
  }
  
  console.log("\n各大洲港口统计:");
  for (const cont of continentOrder) {
    console.log(`  ${continentNames[cont]}: ${continentStats[cont] || 0}`);
  }
  
  // 找出未分类的国家
  const unclassifiedCountries = new Set();
  for (const port of ports) {
    const cc = extractCountryCode(port.country);
    if (cc && !worldRegions.countryToContinent[cc]) {
      unclassifiedCountries.add(cc);
    }
  }
  
  if (unclassifiedCountries.size > 0) {
    console.log(`\n⚠️ 未分类的国家代码 (${unclassifiedCountries.size} 个):`);
    console.log([...unclassifiedCountries].sort().join(", "));
  }
  
  // 按大洲处理并输出
  const allResults = {
    version: "2026.01",
    lastUpdated: new Date().toISOString().split("T")[0],
    totalPorts: ports.length,
    continents: {}
  };
  
  for (const contCode of continentOrder) {
    const result = processContinent(contCode, ports, worldRegions);
    if (result && result.totalPorts > 0) {
      allResults.continents[contCode] = result;
    }
  }
  
  // 输出到文件
  const outputPath = path.join(DATA_DIR, "ports-classified.json");
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n✅ 输出文件: ${outputPath} (${fileSize} KB)`);
  
  // 输出汇总
  console.log("\n" + "=".repeat(60));
  console.log("汇总统计:");
  console.log("=".repeat(60));
  for (const cont of Object.values(allResults.continents)) {
    console.log(`${cont.name}: ${cont.totalPorts} 港口`);
  }
  console.log(`\n总计: ${ports.length} 港口`);
}

main();
