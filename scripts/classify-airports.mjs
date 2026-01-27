/**
 * 按大洲/区域/国家分类机场数据
 * 输出结构化的机场分类 JSON
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_DIR = path.join(ROOT, "public", "data");

const AIRPORTS_CSV = path.join(RAW_DIR, "airports.csv");
const WORLD_REGIONS_JSON = path.join(RAW_DIR, "world-regions.json");
const INTL_AIRPORTS_JSON = path.join(RAW_DIR, "international-airports.json");

// 常用国家中英文映射
const COUNTRY_CN = {
  US: "美国", CN: "中国", JP: "日本", KR: "韩国", DE: "德国",
  GB: "英国", FR: "法国", IT: "意大利", ES: "西班牙", CA: "加拿大",
  AU: "澳大利亚", BR: "巴西", IN: "印度", RU: "俄罗斯", MX: "墨西哥",
  ID: "印度尼西亚", TH: "泰国", VN: "越南", MY: "马来西亚", SG: "新加坡",
  PH: "菲律宾", AE: "阿联酋", SA: "沙特", TR: "土耳其", NL: "荷兰",
  BE: "比利时", CH: "瑞士", AT: "奥地利", SE: "瑞典", NO: "挪威",
  DK: "丹麦", FI: "芬兰", PL: "波兰", CZ: "捷克", PT: "葡萄牙",
  GR: "希腊", IE: "爱尔兰", NZ: "新西兰", ZA: "南非", EG: "埃及",
  AR: "阿根廷", CL: "智利", CO: "哥伦比亚", PE: "秘鲁", VE: "委内瑞拉",
  HK: "中国香港", TW: "中国台湾", MO: "中国澳门", PK: "巴基斯坦", BD: "孟加拉",
  IL: "以色列", IR: "伊朗", IQ: "伊拉克", KW: "科威特", QA: "卡塔尔",
  BH: "巴林", OM: "阿曼", JO: "约旦", LB: "黎巴嫩", SY: "叙利亚",
  YE: "也门", AF: "阿富汗", PG: "巴布亚新几内亚", FJ: "斐济"
};

// 港澳台排序权重（排在中国后面）
const CHINA_REGION_ORDER = { CN: 0, HK: 1, MO: 2, TW: 3 };

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, { columns: true, skip_empty_lines: true });
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

// 加载国际机场白名单
function loadInternationalAirports() {
  if (!fs.existsSync(INTL_AIRPORTS_JSON)) {
    console.warn("Warning: international-airports.json not found");
    return new Set();
  }
  const data = JSON.parse(fs.readFileSync(INTL_AIRPORTS_JSON, "utf8"));
  const codes = new Set();
  for (const country of Object.values(data.airports)) {
    for (const code of country.codes) {
      codes.add(code.toUpperCase());
    }
  }
  return codes;
}

// 处理单个大洲的机场
function processContinent(continentCode, airports, worldRegions, intlCodes) {
  const { data, countryToContinent, countryToRegion, countryInfo } = worldRegions;
  const continent = data.continents[continentCode];
  
  if (!continent) {
    console.error(`Continent ${continentCode} not found`);
    return null;
  }
  
  // 筛选该大洲的机场
  const continentAirports = airports.filter(a => countryToContinent[a.country] === continentCode);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`大洲: ${continent.name} (${continent.nameEn}) - ${continentCode}`);
  console.log(`机场总数: ${continentAirports.length}`);
  console.log(`${"=".repeat(60)}`);
  
  // 按区域和国家分类
  const result = {
    code: continentCode,
    name: continent.name,
    nameEn: continent.nameEn,
    totalAirports: continentAirports.length,
    totalIntl: 0,
    totalDomestic: 0,
    regions: {}
  };
  
  for (const [regCode, region] of Object.entries(continent.regions)) {
    const regionAirports = continentAirports.filter(a => countryToRegion[a.country] === regCode);
    
    if (regionAirports.length === 0) continue;
    
    console.log(`\n  区域: ${region.name} (${regCode})`);
    
    const regionResult = {
      code: regCode,
      name: region.name,
      nameEn: region.nameEn,
      totalAirports: regionAirports.length,
      totalIntl: 0,
      totalDomestic: 0,
      countries: {}
    };
    
    // 按国家分类
    const countryGroups = {};
    for (const airport of regionAirports) {
      if (!countryGroups[airport.country]) {
        countryGroups[airport.country] = [];
      }
      countryGroups[airport.country].push(airport);
    }
    
    // 按机场数量排序国家，但港澳台特殊处理（排在中国后面）
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
    
    for (const [countryCode, countryAirports] of sortedCountries) {
      const info = countryInfo[countryCode] || { name: countryCode, nameEn: countryCode };
      
      // 统计国际/国内机场
      let intlCount = 0;
      let domesticCount = 0;
      
      const airportList = countryAirports.map(a => {
        const isIntl = intlCodes.has(a.iata) || intlCodes.has(a.icao);
        if (isIntl) intlCount++;
        else domesticCount++;
        
        return {
          code: a.code,
          icao: a.icao,
          iata: a.iata,
          name: a.name,
          city: a.city,
          lat: a.lat,
          lng: a.lng,
          intl: isIntl ? 1 : 0
        };
      });
      
      // 按机场代码排序
      airportList.sort((a, b) => a.code.localeCompare(b.code));
      
      regionResult.countries[countryCode] = {
        code: countryCode,
        name: info.name,
        nameEn: info.nameEn,
        totalAirports: countryAirports.length,
        intlAirports: intlCount,
        domesticAirports: domesticCount,
        airports: airportList
      };
      
      regionResult.totalIntl += intlCount;
      regionResult.totalDomestic += domesticCount;
      
      console.log(`    ${info.name} (${countryCode}): ${countryAirports.length} 机场 (国际: ${intlCount}, 国内: ${domesticCount})`);
    }
    
    result.regions[regCode] = regionResult;
    result.totalIntl += regionResult.totalIntl;
    result.totalDomestic += regionResult.totalDomestic;
  }
  
  // 处理未分类的国家（不在 world-regions.json 中的）
  const unclassified = continentAirports.filter(a => !countryToRegion[a.country]);
  if (unclassified.length > 0) {
    console.log(`\n  未分类机场: ${unclassified.length}`);
    const uncountries = [...new Set(unclassified.map(a => a.country))];
    console.log(`  未分类国家: ${uncountries.join(", ")}`);
  }
  
  return result;
}

function main() {
  console.log("开始分类机场数据...\n");
  
  // 加载数据
  const worldRegions = loadWorldRegions();
  const intlCodes = loadInternationalAirports();
  console.log(`已加载 ${intlCodes.size} 个国际机场代码`);
  
  // 读取机场数据
  const rows = parseCsv(AIRPORTS_CSV);
  const allowedTypes = new Set(["large_airport", "medium_airport", "small_airport"]);
  
  const airports = rows
    .filter(row => allowedTypes.has(row.type))
    .filter(row => row.iata_code || row.scheduled_service === "yes")
    .map(row => {
      const lat = toNumber(row.latitude_deg);
      const lng = toNumber(row.longitude_deg);
      if (lat === null || lng === null) return null;
      
      const iata = (row.iata_code || "").trim().toUpperCase();
      const icao = (row.icao_code || row.ident || "").trim().toUpperCase();
      const code = iata || icao;
      if (!code) return null;
      
      return {
        country: row.iso_country,
        code,
        iata,
        icao,
        name: row.name,
        city: row.municipality || "",
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000
      };
    })
    .filter(Boolean);
  
  console.log(`共加载 ${airports.length} 个机场`);
  
  // 统计各大洲机场
  const continentOrder = ["AS", "EU", "NA", "SA", "AF", "OC"];
  const continentNames = {
    AS: "亚洲", EU: "欧洲", NA: "北美洲", SA: "南美洲", AF: "非洲", OC: "大洋洲"
  };
  
  // 统计每个大洲的机场数
  const continentStats = {};
  for (const airport of airports) {
    const cont = worldRegions.countryToContinent[airport.country];
    if (cont) {
      continentStats[cont] = (continentStats[cont] || 0) + 1;
    }
  }
  
  console.log("\n各大洲机场统计:");
  for (const cont of continentOrder) {
    console.log(`  ${continentNames[cont]}: ${continentStats[cont] || 0}`);
  }
  
  // 找出未分类的国家
  const unclassifiedCountries = new Set();
  for (const airport of airports) {
    if (!worldRegions.countryToContinent[airport.country]) {
      unclassifiedCountries.add(airport.country);
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
    totalAirports: airports.length,
    continents: {}
  };
  
  for (const contCode of continentOrder) {
    const result = processContinent(contCode, airports, worldRegions, intlCodes);
    if (result) {
      allResults.continents[contCode] = result;
    }
  }
  
  // 输出到文件
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  
  const outputPath = path.join(OUT_DIR, "airports-classified.json");
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  
  const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n✅ 输出文件: ${outputPath} (${fileSize} KB)`);
  
  // 输出汇总
  console.log("\n" + "=".repeat(60));
  console.log("汇总统计:");
  console.log("=".repeat(60));
  let totalIntl = 0, totalDomestic = 0;
  for (const cont of Object.values(allResults.continents)) {
    console.log(`${cont.name}: ${cont.totalAirports} 机场 (国际: ${cont.totalIntl}, 国内: ${cont.totalDomestic})`);
    totalIntl += cont.totalIntl;
    totalDomestic += cont.totalDomestic;
  }
  console.log(`\n总计: ${airports.length} 机场 (国际: ${totalIntl}, 国内: ${totalDomestic})`);
}

main();
