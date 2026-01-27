/**
 * 读取美国亚马逊仓库Excel并更新warehouses.json
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 文件路径
const excelPath = path.join(__dirname, '../data/raw/美国亚马逊仓库地址2026.1.27.xlsx');
const warehousesPath = path.join(__dirname, '../public/data/warehouses.json');

// 美国各州缩写到名称的映射
const stateNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

// 州名到缩写的反向映射
const stateAbbrevs = {};
for (const [abbr, name] of Object.entries(stateNames)) {
  stateAbbrevs[name.toLowerCase()] = abbr;
  stateAbbrevs[abbr.toLowerCase()] = abbr;
}

// 从地址中提取州缩写
function extractStateFromAddress(address) {
  if (!address) return null;
  
  // 匹配常见格式：", CA ", ", CA,", ", California ", 等
  const patterns = [
    /,\s*([A-Z]{2})\s*\d{5}/i,  // ", CA 90001"
    /,\s*([A-Z]{2})\s*$/i,      // ", CA"
    /,\s*([A-Z]{2})\s*,/i,      // ", CA,"
    /,\s*([A-Z]{2})\s+-/i,      // ", CA -"
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match && stateNames[match[1].toUpperCase()]) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

// 主要城市的近似坐标（用于没有精确坐标的仓库）
const cityCoordinates = {
  // California
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'san bernardino': { lat: 34.1083, lng: -117.2898 },
  'moreno valley': { lat: 33.9425, lng: -117.2297 },
  'riverside': { lat: 33.9533, lng: -117.3962 },
  'fontana': { lat: 34.0922, lng: -117.4350 },
  'rialto': { lat: 34.1064, lng: -117.3703 },
  'eastvale': { lat: 33.9628, lng: -117.5772 },
  'ontario': { lat: 34.0633, lng: -117.6509 },
  'rancho cucamonga': { lat: 34.1064, lng: -117.5931 },
  'perris': { lat: 33.7825, lng: -117.2286 },
  'redlands': { lat: 34.0556, lng: -117.1825 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'fresno': { lat: 36.7378, lng: -119.7871 },
  'stockton': { lat: 37.9577, lng: -121.2908 },
  'tracy': { lat: 37.7397, lng: -121.4252 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'vacaville': { lat: 38.3566, lng: -121.9877 },
  'newark': { lat: 37.5175, lng: -122.0157 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'oakland': { lat: 37.8044, lng: -122.2712 },
  'long beach': { lat: 33.7701, lng: -118.1937 },
  // Texas
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'fort worth': { lat: 32.7555, lng: -97.3308 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'san antonio': { lat: 29.4241, lng: -98.4936 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'coppell': { lat: 32.9546, lng: -97.0150 },
  'haslet': { lat: 32.9715, lng: -97.3478 },
  // Florida
  'miami': { lat: 25.7617, lng: -80.1918 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'jacksonville': { lat: 30.3322, lng: -81.6557 },
  'lakeland': { lat: 28.0395, lng: -81.9498 },
  // New York / New Jersey
  'new york': { lat: 40.7128, lng: -74.0060 },
  'staten island': { lat: 40.5795, lng: -74.1502 },
  'carteret': { lat: 40.5773, lng: -74.2285 },
  'robbinsville': { lat: 40.2198, lng: -74.5879 },
  'edison': { lat: 40.5187, lng: -74.4121 },
  // Pennsylvania
  'carlisle': { lat: 40.2015, lng: -77.1889 },
  'breinigsville': { lat: 40.5385, lng: -75.6329 },
  'hazleton': { lat: 40.9587, lng: -75.9746 },
  'pittsburgh': { lat: 40.4406, lng: -79.9959 },
  // Illinois
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'joliet': { lat: 41.5250, lng: -88.0817 },
  'romeoville': { lat: 41.6475, lng: -88.0892 },
  'aurora': { lat: 41.7606, lng: -88.3201 },
  'edwardsville': { lat: 38.8114, lng: -89.9531 },
  // Georgia
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'union city': { lat: 33.5873, lng: -84.5424 },
  'braselton': { lat: 34.1098, lng: -83.7626 },
  'jefferson': { lat: 34.1118, lng: -83.6007 },
  // Other states
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'kent': { lat: 47.3809, lng: -122.2348 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'plainfield': { lat: 39.7042, lng: -86.3994 },
  'hebron': { lat: 39.0669, lng: -84.7016 },
  'shepherdsville': { lat: 37.9884, lng: -85.7158 },
  'baltimore': { lat: 39.2904, lng: -76.6122 },
  'charlotte': { lat: 35.2271, lng: -80.8431 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'reno': { lat: 39.5296, lng: -119.8138 },
  'portland': { lat: 45.5051, lng: -122.6750 },
  'salt lake city': { lat: 40.7608, lng: -111.8910 },
  'memphis': { lat: 35.1495, lng: -90.0490 },
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'chattanooga': { lat: 35.0456, lng: -85.3097 },
  'kenosha': { lat: 42.5847, lng: -87.8212 },
  'shakopee': { lat: 44.7974, lng: -93.5271 },
};

// 从城市名获取坐标
function getCityCoordinates(city, state) {
  if (!city) return null;
  
  const cityLower = city.toLowerCase().split(',')[0].trim();
  
  if (cityCoordinates[cityLower]) {
    return cityCoordinates[cityLower];
  }
  
  // 尝试部分匹配
  for (const [key, coords] of Object.entries(cityCoordinates)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      return coords;
    }
  }
  
  return null;
}

// 读取并处理Excel
function processExcel() {
  console.log('读取Excel文件...');
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`读取到 ${data.length} 条记录`);
  
  // 打印前几条数据查看结构
  console.log('\n数据结构示例:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
  
  // 处理数据
  const warehouses = [];
  let skipped = 0;
  
  for (const row of data) {
    // 根据实际Excel列名获取数据
    const code = row['仓库编码'] || '';
    const state = row['州/郡'] || '';
    const city = row['城市'] || '';
    const streetAddress = row['地址'] || '';
    const zipCode = row['邮编'] || '';
    const status = row['状态'] || '';
    
    // 跳过无效数据
    if (!code || code.trim() === '') {
      skipped++;
      continue;
    }
    
    // 只处理启用状态的仓库
    if (status && status !== '启用') {
      skipped++;
      continue;
    }
    
    // 组合完整地址：街道地址, 城市, 州 邮编
    let fullAddress = streetAddress.trim();
    if (city) {
      // 检查街道地址是否已包含城市名
      if (!fullAddress.toUpperCase().includes(city.toUpperCase())) {
        fullAddress += fullAddress ? `, ${city}` : city;
      }
    }
    if (state) {
      // 检查是否已包含州名
      if (!fullAddress.toUpperCase().includes(`, ${state.toUpperCase()}`) && 
          !fullAddress.toUpperCase().endsWith(state.toUpperCase())) {
        fullAddress += `, ${state}`;
      }
    }
    if (zipCode) {
      // 检查是否已包含邮编
      const zipClean = zipCode.toString().split('-')[0]; // 取主邮编
      if (!fullAddress.includes(zipClean)) {
        fullAddress += ` ${zipCode}`;
      }
    }
    
    // 清理地址格式
    fullAddress = fullAddress
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/,\s*,/g, ',')
      .trim();
    
    // 获取坐标
    const coords = getCityCoordinates(city, state) || { lat: 39.8283, lng: -98.5795 }; // 默认美国中心
    
    // 格式化城市名
    const cityFormatted = city ? `${city}, ${state}` : state;
    
    warehouses.push({
      code: code.trim(),
      name: code.trim(),
      city: cityFormatted,
      state: state.trim(),
      address: fullAddress,
      type: 'FC',
      lat: coords.lat,
      lng: coords.lng
    });
  }
  
  console.log(`\n处理完成: ${warehouses.length} 个仓库, 跳过 ${skipped} 条无效记录`);
  
  return warehouses;
}

// 更新warehouses.json
function updateWarehousesJson(newWarehouses) {
  console.log('\n读取现有warehouses.json...');
  const warehousesData = JSON.parse(fs.readFileSync(warehousesPath, 'utf8'));
  
  // 更新美国亚马逊仓库
  warehousesData.categories.amazon.countries.US.warehouses = newWarehouses;
  warehousesData.categories.amazon.countries.US.totalWarehouses = newWarehouses.length;
  
  // 重新计算总数
  let amazonTotal = 0;
  for (const country of Object.values(warehousesData.categories.amazon.countries)) {
    amazonTotal += country.warehouses.length;
  }
  warehousesData.categories.amazon.totalWarehouses = amazonTotal;
  
  // 写入文件
  fs.writeFileSync(warehousesPath, JSON.stringify(warehousesData, null, 2));
  console.log(`\n更新完成! 美国亚马逊仓库: ${newWarehouses.length} 个`);
  console.log(`亚马逊总仓库: ${amazonTotal} 个`);
}

// 执行
try {
  const warehouses = processExcel();
  if (warehouses.length > 0) {
    updateWarehousesJson(warehouses);
  }
} catch (err) {
  console.error('处理失败:', err);
}
