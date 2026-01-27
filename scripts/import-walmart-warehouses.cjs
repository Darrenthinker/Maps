/**
 * 导入沃尔玛仓库数据
 */

const fs = require('fs');
const path = require('path');

// 沃尔玛仓库原始数据
const walmartData = [
  { code: 'LAX2', address: '6720 Kimball Ave', city: 'Chino', state: 'CA', zip: '91708' },
  { code: 'NJ3', address: '3 Sorbello Rd', city: 'Pedricktown', state: 'NJ', zip: '08067' },
  { code: 'KY1', address: '120 Velocity Way', city: 'Shepherdsville', state: 'KY', zip: '40165' },
  { code: 'IND1', address: '9590 ALLPOINTS PARKWAY', city: 'PLAINFIELD', state: 'IN', zip: '46168' },
  { code: 'ATL3', address: '445 Valentine Industrial Parkway', city: 'Pendergrass', state: 'GA', zip: '30567' },
  { code: 'PHX1', address: '6600 North Sarival Avenue', city: 'Litchfield Park', state: 'AZ', zip: '85340' },
  { code: 'PHL2', address: '2785 Commerce Center Blvd', city: 'Bethlehem', state: 'PA', zip: '18015' },
  { code: 'LAX1', address: '6750 Kimball Avenue', city: 'Chino', state: 'CA', zip: '91708' },
  { code: 'MCO1', address: '5100 NORTH RIDGE TRAIL', city: 'DAVENPORT', state: 'FL', zip: '33897' },
  { code: 'SMF1', address: '7000 Powerline Rd', city: 'Sacramento', state: 'CA', zip: '95837' },
  { code: 'IND2', address: '9360 AllPoints Pkwy', city: 'Avon', state: 'IN', zip: '46123' },
  { code: 'W-PHL2', address: '2785 Commerce Center Boulevard', city: 'Bethlehem', state: 'PA', zip: '18015' },
  { code: 'KS1', address: '30801 W 191st St', city: 'EDGERTON', state: 'KS', zip: '66021' },
  { code: 'ATL2', address: '3101 US-27', city: 'Carrollton', state: 'GA', zip: '30117' },
  { code: 'MCI1n', address: '1303 Sw Innovation Pkway', city: 'Topeka', state: 'KS', zip: '66619' },
  { code: 'ATL1', address: '6055 S Fulton Pkwy', city: 'Atlanta', state: 'GA', zip: '30349' },
  { code: 'IND2T', address: '9360 AllPoints Pkwy. Suite 162', city: 'Plainfield', state: 'IN', zip: '46168' },
  { code: 'IND2N', address: '9360 ALLPOINTS PKWY. SUITE 107', city: 'PLAINFIELD', state: 'IN', zip: '46168' },
  { code: 'ATL2n', address: '3101 N. Highway 27', city: 'Carrollton', state: 'GA', zip: '30117' },
  { code: 'MEM1-S', address: '9200 Alexander Road', city: 'Olive Branch', state: 'MS', zip: '38654' },
  { code: 'PHL4n', address: '1410 United Dr', city: 'Shippensburg', state: 'PA', zip: '17257' },
  { code: 'ORD1s', address: '3501 Brandon Road', city: 'Joliet', state: 'IL', zip: '60436' },
  { code: 'BNA1s', address: '1015 Hixson Blvd', city: 'Lebanon', state: 'TN', zip: '37090' },
  { code: 'W-MEM1s', address: '10480 Marina Drive', city: 'Olive Branch', state: 'MS', zip: '38654' },
  { code: 'W-IND3', address: '5756 Enterprise Dr', city: 'Mccordsville', state: 'IN', zip: '46055' },
  { code: 'CVG1n', address: '650 Gateway Blvd', city: 'Monroe', state: 'OH', zip: '45050' },
  { code: 'DFW5s', address: '2500 E Belt Line Rd', city: 'Lancaster', state: 'TX', zip: '75146' },
  { code: 'NJ3T', address: '7 Sorbello Rd', city: 'Pedricktown', state: 'NJ', zip: '08067' },
  { code: 'DFW2n', address: '15101 N Beach ST', city: 'Fort Worth', state: 'TX', zip: '76177' },
  { code: 'PHL5s', address: '1915 Ebberts Spg Ct', city: 'Greencastle', state: 'PA', zip: '17225' },
  { code: 'PHL1s', address: '3215 Commerce Center Blvd', city: 'Bethlehem', state: 'PA', zip: '18015' },
  { code: 'DFW6s', address: '14700 Blue Mound Rd', city: 'Fort Worth', state: 'TX', zip: '76052' },
];

// 加拿大仓库
const canadaData = [
  { code: 'W-DC2030', address: '233 Madill Blvd.', city: 'Mississauga', state: 'ON', zip: 'L5W 1Y6' },
  { code: '0003503GDM', address: '233 Madill Blvd.', city: 'Mississauga', state: 'ON', zip: 'L5W 0H1' },
  { code: 'DC2028', address: '10 High Plns Tr', city: 'Rocky View', state: 'AB', zip: 'T4A 3M6' },
  { code: 'DC2093', address: '6175 Edwards Blvd', city: 'Mississauga', state: 'ON', zip: 'L5T 2W7' },
];

// 美国各州坐标（近似城市中心）
const usCityCoords = {
  'chino': { lat: 33.9898, lng: -117.6874 },
  'pedricktown': { lat: 39.7576, lng: -75.4027 },
  'shepherdsville': { lat: 37.9884, lng: -85.7158 },
  'plainfield': { lat: 39.7042, lng: -86.3994 },
  'pendergrass': { lat: 34.1615, lng: -83.6768 },
  'litchfield park': { lat: 33.4934, lng: -112.3579 },
  'bethlehem': { lat: 40.6259, lng: -75.3705 },
  'davenport': { lat: 28.1614, lng: -81.6017 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'avon': { lat: 39.7628, lng: -86.3997 },
  'edgerton': { lat: 38.7642, lng: -95.0169 },
  'carrollton': { lat: 33.5801, lng: -85.0766 },
  'topeka': { lat: 39.0473, lng: -95.6752 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'olive branch': { lat: 34.9617, lng: -89.8295 },
  'shippensburg': { lat: 40.0507, lng: -77.5203 },
  'joliet': { lat: 41.5250, lng: -88.0817 },
  'lebanon': { lat: 36.2081, lng: -86.2911 },
  'mccordsville': { lat: 39.9067, lng: -85.9227 },
  'monroe': { lat: 39.4401, lng: -84.3621 },
  'lancaster': { lat: 32.5921, lng: -96.7561 },
  'fort worth': { lat: 32.7555, lng: -97.3308 },
  'greencastle': { lat: 39.7898, lng: -77.7272 },
};

// 加拿大城市坐标
const canadaCityCoords = {
  'mississauga': { lat: 43.5890, lng: -79.6441 },
  'rocky view': { lat: 51.2537, lng: -114.0179 },
};

// 加拿大省份中文名
const canadaProvinces = {
  'ON': '安大略省',
  'AB': '艾伯塔省',
  'BC': '不列颠哥伦比亚省',
  'QC': '魁北克省',
};

// 美国州中文名
const usStates = {
  'CA': '加利福尼亚州', 'NJ': '新泽西州', 'KY': '肯塔基州', 'IN': '印第安纳州',
  'GA': '佐治亚州', 'AZ': '亚利桑那州', 'PA': '宾夕法尼亚州', 'FL': '佛罗里达州',
  'KS': '堪萨斯州', 'MS': '密西西比州', 'IL': '伊利诺伊州', 'TN': '田纳西州',
  'OH': '俄亥俄州', 'TX': '得克萨斯州',
};

function getCoords(city, country) {
  const cityLower = city.toLowerCase();
  if (country === 'US') {
    return usCityCoords[cityLower] || { lat: 39.8283, lng: -98.5795 };
  } else {
    return canadaCityCoords[cityLower] || { lat: 56.1304, lng: -106.3468 };
  }
}

function formatAddress(address, city, state, zip) {
  // 标准化地址格式
  let addr = `${address}, ${city}, ${state} ${zip}`;
  return addr.replace(/\s+/g, ' ').trim();
}

function processWarehouses() {
  const warehousesPath = path.join(__dirname, '../public/data/warehouses.json');
  const warehousesData = JSON.parse(fs.readFileSync(warehousesPath, 'utf8'));
  
  // 处理美国仓库
  const usWarehouses = walmartData.map(w => {
    const coords = getCoords(w.city, 'US');
    return {
      code: w.code,
      name: w.code,
      city: `${w.city}, ${w.state}`,
      state: w.state,
      address: formatAddress(w.address, w.city, w.state, w.zip),
      type: 'WFS',
      lat: coords.lat,
      lng: coords.lng
    };
  });
  
  // 处理加拿大仓库
  const caWarehouses = canadaData.map(w => {
    const coords = getCoords(w.city, 'CA');
    return {
      code: w.code,
      name: w.code,
      city: `${w.city}, ${w.state}`,
      state: w.state,
      address: formatAddress(w.address, w.city, w.state, w.zip),
      type: 'WFS',
      lat: coords.lat,
      lng: coords.lng
    };
  });
  
  // 更新 walmart 分类
  warehousesData.categories.walmart.countries = {
    US: {
      name: '美国',
      nameEn: 'United States',
      totalWarehouses: usWarehouses.length,
      warehouses: usWarehouses
    },
    CA: {
      name: '加拿大',
      nameEn: 'Canada',
      totalWarehouses: caWarehouses.length,
      warehouses: caWarehouses
    }
  };
  
  warehousesData.categories.walmart.totalWarehouses = usWarehouses.length + caWarehouses.length;
  
  // 写入文件
  fs.writeFileSync(warehousesPath, JSON.stringify(warehousesData, null, 2));
  
  console.log(`沃尔玛仓库导入完成！`);
  console.log(`- 美国: ${usWarehouses.length} 个`);
  console.log(`- 加拿大: ${caWarehouses.length} 个`);
  console.log(`- 总计: ${usWarehouses.length + caWarehouses.length} 个`);
}

processWarehouses();
