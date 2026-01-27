/**
 * 按综合指标对机场进行排序
 * 排序维度：国际机场 > 货物吞吐量 > 城市人口 > 城市GDP
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

const AIRPORTS_PATH = path.join(DATA_DIR, "airports-classified.json");
const RANKING_DATA_PATH = path.join(RAW_DIR, "airport-ranking-data.json");

// 排序权重配置
const WEIGHTS = {
  international: 1000,  // 国际机场加分
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

// 计算机场综合评分
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

// 对单个国家的机场进行排序
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

// 处理所有数据
function processAllAirports() {
  console.log("开始对机场进行综合排序...\n");
  
  // 加载数据
  const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));
  const rankingData = loadRankingData();
  
  console.log(`已加载排序参考数据，包含 ${Object.keys(rankingData.countries || {}).length} 个国家的数据`);
  
  let totalSorted = 0;
  let countriesWithData = 0;
  let countriesWithoutData = 0;
  
  // 遍历所有大洲
  for (const [contCode, continent] of Object.entries(airportsData.continents || {})) {
    console.log(`\n处理大洲: ${continent.name} (${contCode})`);
    
    // 遍历所有区域
    for (const [regCode, region] of Object.entries(continent.regions || {})) {
      console.log(`  区域: ${region.name}`);
      
      // 遍历所有国家
      for (const [countryCode, country] of Object.entries(region.countries || {})) {
        const hasRankingData = !!rankingData.countries?.[countryCode];
        
        // 对机场排序
        const sortedAirports = sortCountryAirports(country.airports || [], countryCode, rankingData);
        country.airports = sortedAirports;
        
        if (hasRankingData) {
          countriesWithData++;
          console.log(`    ✓ ${country.name} (${countryCode}): ${sortedAirports.length} 机场 [有排序数据]`);
          
          // 显示前5个机场
          const top5 = sortedAirports.slice(0, 5);
          for (const ap of top5) {
            const intlMark = ap.intl ? "🌐" : "  ";
            console.log(`      ${intlMark} ${ap.code} - ${ap.nameZh || ap.name} (${ap.city})`);
          }
        } else {
          countriesWithoutData++;
          // 没有排序数据的国家，仍按国际/国内分组，然后按代码排序
          country.airports = sortedAirports.sort((a, b) => {
            if (a.intl !== b.intl) return b.intl - a.intl;
            return a.code.localeCompare(b.code);
          });
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
  console.log(`有排序数据的国家: ${countriesWithData}`);
  console.log(`无排序数据的国家: ${countriesWithoutData} (按国际/国内 + 代码排序)`);
  console.log(`\n✅ 已保存到 ${AIRPORTS_PATH}`);
}

processAllAirports();
