/**
 * 修复中亚港口数据 - 中亚是内陆地区，没有海港
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/data/ports-classified.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 修复中亚的totalPorts（内陆地区无海港）
console.log('修复前 - 中亚 totalPorts:', data.continents.AS.regions.CA.totalPorts);
data.continents.AS.regions.CA.totalPorts = 0;

// 重新计算亚洲各区域和总港口数
let asiaTotal = 0;
for (const [regCode, region] of Object.entries(data.continents.AS.regions)) {
  let regionTotal = 0;
  for (const country of Object.values(region.countries || {})) {
    regionTotal += country.ports?.length || 0;
  }
  region.totalPorts = regionTotal;
  asiaTotal += regionTotal;
  console.log(`${region.name} (${regCode}): ${regionTotal} 个港口`);
}
data.continents.AS.totalPorts = asiaTotal;

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log('\n修复完成！');
console.log('亚洲总港口数:', asiaTotal);
