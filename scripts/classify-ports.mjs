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
const PORT_NAMES_ZH_JSON = path.join(RAW_DIR, "port-names-zh.json");

// 港澳台排序权重（排在中国后面）
const CHINA_REGION_ORDER = { CN: 0, HK: 1, MO: 2, TW: 3 };

// 港口名称关键词 - 用于识别真正的港口
const PORT_KEYWORDS = [
  // 英文关键词
  'port', 'pt', 'terminal', 'harbour', 'harbor', 'dock', 'wharf', 'quay', 'pier',
  'anchorage', 'berth', 'jetty', 'marina', 'seaport', 'freeport',
  // 中文关键词
  '港', '码头', '泊位', '锚地', '船厂', '堆场'
];

// 检查是否是真正的港口（而不是城市）
function isRealPort(port) {
  const name = (port.name || '').toLowerCase();
  const nameZh = port.nameZh || '';
  const city = (port.city || '').toLowerCase();
  
  // 优先检查：如果中文名以"市"、"区"、"县"结尾，一定是城市而非港口
  if (nameZh && (nameZh.endsWith('市') || nameZh.endsWith('区') || nameZh.endsWith('县'))) {
    return false;
  }
  
  // 1. 中文名包含港口关键词
  const zhPortKeywords = ['港', '码头', '泊位', '锚地', '船厂', '堆场', '航运'];
  for (const keyword of zhPortKeywords) {
    if (nameZh.includes(keyword)) {
      return true;
    }
  }
  
  // 2. 英文名包含港口关键词
  const enPortKeywords = ['port', ' pt', 'terminal', 'harbour', 'harbor', 'dock', 'wharf', 
                          'quay', 'pier', 'anchorage', 'berth', 'jetty', 'marina', 'seaport', 'freeport'];
  for (const keyword of enPortKeywords) {
    if (name.includes(keyword)) {
      return true;
    }
  }
  
  // 3. 如果名称和城市完全相同，说明这是城市而不是港口
  const nameClean = name.replace(/[,\s]/g, '').toLowerCase();
  const cityClean = city.replace(/[,\s]/g, '').toLowerCase();
  
  if (nameClean === cityClean) {
    return false;
  }
  
  // 4. 默认不保留（更严格的过滤）
  return false;
}

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

// 加载静态中文名映射
function loadPortNamesZh() {
  if (!fs.existsSync(PORT_NAMES_ZH_JSON)) {
    console.warn("Warning: port-names-zh.json not found, Chinese names will be empty");
    return {};
  }
  const data = JSON.parse(fs.readFileSync(PORT_NAMES_ZH_JSON, "utf8"));
  console.log(`已加载 ${data.totalCount} 个港口中文名 (更新于 ${data.lastUpdated})`);
  return data.names || {};
}

// 从 country 字段提取国家代码（如 "AE 阿联酋" -> "AE"）
function extractCountryCode(countryField) {
  if (!countryField) return null;
  const match = countryField.match(/^([A-Z]{2})/);
  return match ? match[1] : null;
}

// 处理单个大洲的港口
function processContinent(continentCode, ports, worldRegions, namesZh) {
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
    
    // 按国家分类，同时过滤非港口条目
    const countryGroups = {};
    let filteredCount = 0;
    for (const port of regionPorts) {
      const cc = extractCountryCode(port.country);
      
      // 预先获取中文名用于判断
      const portWithZh = { ...port, nameZh: namesZh[port.code] || '' };
      
      // 过滤非真正的港口
      if (!isRealPort(portWithZh)) {
        filteredCount++;
        continue;
      }
      
      if (!countryGroups[cc]) {
        countryGroups[cc] = [];
      }
      countryGroups[cc].push(port);
    }
    
    if (filteredCount > 0) {
      console.log(`    (过滤了 ${filteredCount} 个非港口条目)`);
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
      
      const portList = countryPorts.map(p => {
        // 从静态映射中获取中文名
        const nameZh = namesZh[p.code] || "";
        return {
          code: p.code,
          name: p.name,
          nameZh: nameZh,
          city: p.city,
          lat: p.lat,
          lng: p.lng
        };
      });
      
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
  
  // 加载静态中文名映射
  const namesZh = loadPortNamesZh();
  
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
    const result = processContinent(contCode, ports, worldRegions, namesZh);
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
