/**
 * 按综合指标对港口进行排序
 * 有数据的国家：国际港口 > 货物吞吐量 > 城市人口 > 城市GDP
 * 无数据的国家：国际港口 > 首都 > 城市人口
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

const PORTS_PATH = path.join(DATA_DIR, "ports-classified.json");
const RANKING_DATA_PATH = path.join(RAW_DIR, "port-ranking-data.json");
const AIRPORT_RANKING_PATH = path.join(RAW_DIR, "airport-ranking-data.json");
const CAPITALS_PATH = path.join(RAW_DIR, "country-capitals.json");

// 排序权重配置
const WEIGHTS = {
  international: 1000,  // 国际港口加分
  capital: 500,         // 首都加分
  cargo: 0.00001,       // 货物吞吐量权重 (TEU -> 分)
  population: 0.00001,  // 人口权重 (人 -> 分)
  gdp: 0.01             // GDP权重 (亿元 -> 分)
};

// 加载港口排序参考数据
function loadPortRankingData() {
  if (!fs.existsSync(RANKING_DATA_PATH)) {
    console.warn("Warning: port-ranking-data.json not found");
    return { countries: {} };
  }
  return JSON.parse(fs.readFileSync(RANKING_DATA_PATH, "utf8"));
}

// 加载机场排序数据（复用城市数据）
function loadAirportRankingData() {
  if (!fs.existsSync(AIRPORT_RANKING_PATH)) {
    return { countries: {} };
  }
  return JSON.parse(fs.readFileSync(AIRPORT_RANKING_PATH, "utf8"));
}

// 加载首都数据
function loadCapitalsData() {
  if (!fs.existsSync(CAPITALS_PATH)) {
    console.warn("Warning: country-capitals.json not found");
    return { capitals: {} };
  }
  return JSON.parse(fs.readFileSync(CAPITALS_PATH, "utf8"));
}

// 计算港口综合评分（有完整数据的国家）
function calculateScore(port, portRankingData, airportRankingData, countryCode) {
  let score = 0;
  
  const portData = portRankingData.countries?.[countryCode];
  const cityData = airportRankingData.countries?.[countryCode];
  
  // 1. 国际港口加分
  const portInfo = portData?.ports?.[port.code];
  if (portInfo?.intl === 1) {
    score += WEIGHTS.international;
  }
  
  // 2. 货物吞吐量加分
  if (portInfo?.cargo) {
    score += portInfo.cargo * WEIGHTS.cargo;
  }
  
  // 3. 城市人口加分（从机场数据复用）
  const city = findCityData(port.city, cityData);
  if (city?.population) {
    score += city.population * WEIGHTS.population;
  }
  
  // 4. 城市GDP加分
  if (city?.gdp) {
    score += city.gdp * WEIGHTS.gdp;
  }
  
  return score;
}

// 计算港口评分（简化版：用于无完整数据的国家）
function calculateSimpleScore(port, capitalInfo) {
  let score = 0;
  
  // 1. 首都港口加分
  if (capitalInfo && port.city) {
    const cityLower = port.city.toLowerCase();
    const capitalLower = capitalInfo.capital?.toLowerCase() || "";
    const capitalZh = capitalInfo.capitalZh || "";
    
    // 匹配首都
    if (cityLower.includes(capitalLower) || capitalLower.includes(cityLower) ||
        port.city.includes(capitalZh) || port.name?.includes(capitalZh)) {
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

// 对单个国家的港口进行排序（有完整数据）
function sortCountryPorts(ports, countryCode, portRankingData, airportRankingData) {
  // 计算每个港口的评分
  const scoredPorts = ports.map(port => ({
    ...port,
    _score: calculateScore(port, portRankingData, airportRankingData, countryCode)
  }));
  
  // 按评分降序排序
  scoredPorts.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.code.localeCompare(b.code);
  });
  
  // 移除临时评分字段
  return scoredPorts.map(({ _score, ...rest }) => rest);
}

// 对单个国家的港口进行排序（无完整数据，使用首都）
function sortCountryPortsSimple(ports, countryCode, capitalsData) {
  const capitalInfo = capitalsData.capitals?.[countryCode];
  
  // 计算每个港口的评分
  const scoredPorts = ports.map(port => ({
    ...port,
    _score: calculateSimpleScore(port, capitalInfo)
  }));
  
  // 按评分降序排序，评分相同按代码排序
  scoredPorts.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.code.localeCompare(b.code);
  });
  
  // 移除临时评分字段
  return scoredPorts.map(({ _score, ...rest }) => rest);
}

// 处理所有数据
function processAllPorts() {
  console.log("开始对港口进行综合排序...\n");
  
  // 加载数据
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));
  const portRankingData = loadPortRankingData();
  const airportRankingData = loadAirportRankingData();
  const capitalsData = loadCapitalsData();
  
  console.log(`已加载港口排序参考数据，包含 ${Object.keys(portRankingData.countries || {}).length} 个国家的港口吞吐量数据`);
  console.log(`已加载城市数据，包含 ${Object.keys(airportRankingData.countries || {}).length} 个国家的城市人口/GDP数据`);
  console.log(`已加载首都数据，包含 ${Object.keys(capitalsData.capitals || {}).length} 个国家的首都信息`);
  
  let totalSorted = 0;
  let countriesWithFullData = 0;
  let countriesWithCapitalData = 0;
  let countriesWithNoData = 0;
  
  // 遍历所有大洲
  for (const [contCode, continent] of Object.entries(portsData.continents || {})) {
    console.log(`\n处理大洲: ${continent.name} (${contCode})`);
    
    // 遍历所有区域
    for (const [regCode, region] of Object.entries(continent.regions || {})) {
      console.log(`  区域: ${region.name}`);
      
      // 遍历所有国家
      for (const [countryCode, country] of Object.entries(region.countries || {})) {
        const hasPortData = !!portRankingData.countries?.[countryCode];
        const hasCapitalData = !!capitalsData.capitals?.[countryCode];
        
        let sortedPorts;
        
        if (hasPortData) {
          // 有完整港口排序数据
          sortedPorts = sortCountryPorts(country.ports || [], countryCode, portRankingData, airportRankingData);
          countriesWithFullData++;
          console.log(`    ✓ ${country.name} (${countryCode}): ${sortedPorts.length} 港口 [完整数据]`);
        } else if (hasCapitalData) {
          // 有首都数据
          sortedPorts = sortCountryPortsSimple(country.ports || [], countryCode, capitalsData);
          countriesWithCapitalData++;
          const capitalInfo = capitalsData.capitals[countryCode];
          console.log(`    ○ ${country.name} (${countryCode}): ${sortedPorts.length} 港口 [首都: ${capitalInfo.capitalZh}]`);
        } else {
          // 无数据，按代码排序
          sortedPorts = (country.ports || []).sort((a, b) => a.code.localeCompare(b.code));
          countriesWithNoData++;
        }
        
        country.ports = sortedPorts;
        
        // 显示前3个港口（仅有数据的国家）
        if (hasPortData || hasCapitalData) {
          const top3 = sortedPorts.slice(0, 3);
          for (const p of top3) {
            console.log(`        ${p.code} - ${p.nameZh || p.name} (${p.city})`);
          }
        }
        
        totalSorted += sortedPorts.length;
      }
    }
  }
  
  // 保存排序后的数据
  fs.writeFileSync(PORTS_PATH, JSON.stringify(portsData, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log("排序完成！");
  console.log("=".repeat(60));
  console.log(`总计排序: ${totalSorted} 个港口`);
  console.log(`有完整排序数据的国家: ${countriesWithFullData}`);
  console.log(`有首都数据的国家: ${countriesWithCapitalData}`);
  console.log(`无数据的国家: ${countriesWithNoData} (按代码排序)`);
  console.log(`\n✅ 已保存到 ${PORTS_PATH}`);
}

processAllPorts();
