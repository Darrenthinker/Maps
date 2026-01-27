/**
 * 按综合指标对机场进行排序
 * 有数据的国家：国际机场 > 货物吞吐量 > 城市人口 > 城市GDP
 * 无数据的国家：国际机场 > 首都 > 城市人口
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

const AIRPORTS_PATH = path.join(DATA_DIR, "airports-classified.json");
const RANKING_DATA_PATH = path.join(RAW_DIR, "airport-ranking-data.json");
const CAPITALS_PATH = path.join(RAW_DIR, "country-capitals.json");

// 排序权重配置
const WEIGHTS = {
  international: 1000,  // 国际机场加分
  capital: 500,         // 首都加分
  cargo: 0.0001,        // 货物吞吐量权重 (吨 -> 分)
  population: 0.00001,  // 人口权重 (人 -> 分)
  gdp: 0.01             // GDP权重 (亿元 -> 分)
};

// 加载排序参考数据
function loadRankingData() {
  if (!fs.existsSync(RANKING_DATA_PATH)) {
    console.warn("Warning: airport-ranking-data.json not found");
    return { countries: {} };
  }
  return JSON.parse(fs.readFileSync(RANKING_DATA_PATH, "utf8"));
}

// 加载首都数据
function loadCapitalsData() {
  if (!fs.existsSync(CAPITALS_PATH)) {
    console.warn("Warning: country-capitals.json not found");
    return { capitals: {} };
  }
  return JSON.parse(fs.readFileSync(CAPITALS_PATH, "utf8"));
}

// 计算机场综合评分（有完整数据的国家）
function calculateScore(airport, countryData) {
  let score = 0;
  
  // 1. 国际机场加分
  if (airport.intl === 1) {
    score += WEIGHTS.international;
  }
  
  // 2. 货物吞吐量加分
  const airportCargo = countryData?.airports?.[airport.iata || airport.code];
  if (airportCargo?.cargo) {
    score += airportCargo.cargo * WEIGHTS.cargo;
  }
  
  // 3. 城市人口加分
  const cityData = findCityData(airport.city, countryData);
  if (cityData?.population) {
    score += cityData.population * WEIGHTS.population;
  }
  
  // 4. 城市GDP加分
  if (cityData?.gdp) {
    score += cityData.gdp * WEIGHTS.gdp;
  }
  
  return score;
}

// 计算机场评分（简化版：用于无完整数据的国家）
function calculateSimpleScore(airport, capitalInfo) {
  let score = 0;
  
  // 1. 国际机场加分
  if (airport.intl === 1) {
    score += WEIGHTS.international;
  }
  
  // 2. 首都机场加分
  if (capitalInfo && airport.city) {
    const cityLower = airport.city.toLowerCase();
    const capitalLower = capitalInfo.capital?.toLowerCase() || "";
    const capitalZh = capitalInfo.capitalZh || "";
    
    // 匹配首都
    if (cityLower.includes(capitalLower) || capitalLower.includes(cityLower) ||
        airport.city.includes(capitalZh)) {
      score += WEIGHTS.capital;
      // 首都人口作为额外加分
      if (capitalInfo.population) {
        score += capitalInfo.population * WEIGHTS.population;
      }
    }
  }
  
  return score;
}

// 模糊匹配城市数据
function findCityData(cityName, countryData) {
  if (!cityName || !countryData?.cities) return null;
  
  const cityLower = cityName.toLowerCase().trim();
  
  // 直接匹配
  for (const [name, data] of Object.entries(countryData.cities)) {
    if (name.toLowerCase() === cityLower) {
      return data;
    }
  }
  
  // 包含匹配
  for (const [name, data] of Object.entries(countryData.cities)) {
    if (cityLower.includes(name.toLowerCase()) || name.toLowerCase().includes(cityLower)) {
      return data;
    }
  }
  
  // 中文名匹配
  for (const [name, data] of Object.entries(countryData.cities)) {
    if (data.nameZh && cityName.includes(data.nameZh)) {
      return data;
    }
  }
  
  return null;
}

// 对单个国家的机场进行排序（有完整数据）
function sortCountryAirports(airports, countryCode, rankingData) {
  const countryData = rankingData.countries?.[countryCode];
  
  // 计算每个机场的评分
  const scoredAirports = airports.map(airport => ({
    ...airport,
    _score: calculateScore(airport, countryData)
  }));
  
  // 按评分降序排序
  scoredAirports.sort((a, b) => b._score - a._score);
  
  // 移除临时评分字段
  return scoredAirports.map(({ _score, ...rest }) => rest);
}

// 对单个国家的机场进行排序（无完整数据，使用首都）
function sortCountryAirportsSimple(airports, countryCode, capitalsData) {
  const capitalInfo = capitalsData.capitals?.[countryCode];
  
  // 计算每个机场的评分
  const scoredAirports = airports.map(airport => ({
    ...airport,
    _score: calculateSimpleScore(airport, capitalInfo)
  }));
  
  // 按评分降序排序，评分相同按代码排序
  scoredAirports.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.code.localeCompare(b.code);
  });
  
  // 移除临时评分字段
  return scoredAirports.map(({ _score, ...rest }) => rest);
}

// 处理所有数据
function processAllAirports() {
  console.log("开始对机场进行综合排序...\n");
  
  // 加载数据
  const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));
  const rankingData = loadRankingData();
  const capitalsData = loadCapitalsData();
  
  console.log(`已加载排序参考数据，包含 ${Object.keys(rankingData.countries || {}).length} 个国家的完整数据`);
  console.log(`已加载首都数据，包含 ${Object.keys(capitalsData.capitals || {}).length} 个国家的首都信息`);
  
  let totalSorted = 0;
  let countriesWithFullData = 0;
  let countriesWithCapitalData = 0;
  let countriesWithNoData = 0;
  
  // 遍历所有大洲
  for (const [contCode, continent] of Object.entries(airportsData.continents || {})) {
    console.log(`\n处理大洲: ${continent.name} (${contCode})`);
    
    // 遍历所有区域
    for (const [regCode, region] of Object.entries(continent.regions || {})) {
      console.log(`  区域: ${region.name}`);
      
      // 遍历所有国家
      for (const [countryCode, country] of Object.entries(region.countries || {})) {
        const hasFullData = !!rankingData.countries?.[countryCode];
        const hasCapitalData = !!capitalsData.capitals?.[countryCode];
        
        let sortedAirports;
        
        if (hasFullData) {
          // 有完整排序数据
          sortedAirports = sortCountryAirports(country.airports || [], countryCode, rankingData);
          countriesWithFullData++;
          console.log(`    ✓ ${country.name} (${countryCode}): ${sortedAirports.length} 机场 [完整数据]`);
        } else if (hasCapitalData) {
          // 有首都数据
          sortedAirports = sortCountryAirportsSimple(country.airports || [], countryCode, capitalsData);
          countriesWithCapitalData++;
          const capitalInfo = capitalsData.capitals[countryCode];
          console.log(`    ○ ${country.name} (${countryCode}): ${sortedAirports.length} 机场 [首都: ${capitalInfo.capitalZh}]`);
        } else {
          // 无数据，按国际/国内 + 代码排序
          sortedAirports = (country.airports || []).sort((a, b) => {
            if (a.intl !== b.intl) return b.intl - a.intl;
            return a.code.localeCompare(b.code);
          });
          countriesWithNoData++;
        }
        
        country.airports = sortedAirports;
        
        // 显示前3个机场（仅有数据的国家）
        if (hasFullData || hasCapitalData) {
          const top3 = sortedAirports.slice(0, 3);
          for (const ap of top3) {
            const intlMark = ap.intl ? "🌐" : "  ";
            console.log(`      ${intlMark} ${ap.code} - ${ap.nameZh || ap.name} (${ap.city})`);
          }
        }
        
        totalSorted += sortedAirports.length;
      }
    }
  }
  
  // 保存排序后的数据
  fs.writeFileSync(AIRPORTS_PATH, JSON.stringify(airportsData, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log("排序完成！");
  console.log("=".repeat(60));
  console.log(`总计排序: ${totalSorted} 个机场`);
  console.log(`有完整排序数据的国家: ${countriesWithFullData}`);
  console.log(`有首都数据的国家: ${countriesWithCapitalData}`);
  console.log(`无数据的国家: ${countriesWithNoData} (按国际/国内 + 代码排序)`);
  console.log(`\n✅ 已保存到 ${AIRPORTS_PATH}`);
}

processAllAirports();
