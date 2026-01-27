/**
 * 修复国际机场标记 - 名称含"International"或"国际"的机场应标记为intl: 1
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/data/airports-classified.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let fixedCount = 0;
let fixedAirports = [];

// 遍历所有机场
for (const [contCode, cont] of Object.entries(data.continents)) {
  for (const [regCode, reg] of Object.entries(cont.regions)) {
    for (const [countryCode, country] of Object.entries(reg.countries)) {
      let countryIntlCount = 0;
      
      for (const airport of country.airports || []) {
        const nameHasIntl = 
          (airport.name || '').toLowerCase().includes('international') ||
          (airport.nameZh || '').includes('国际');
        
        if (nameHasIntl && airport.intl !== 1) {
          airport.intl = 1;
          fixedCount++;
          fixedAirports.push({
            code: airport.code,
            name: airport.nameZh || airport.name,
            country: country.name
          });
        }
        
        if (airport.intl === 1) {
          countryIntlCount++;
        }
      }
      
      // 更新国家的国际机场计数
      country.intlAirports = countryIntlCount;
    }
  }
}

// 保存修复后的数据
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log(`修复完成！共修复 ${fixedCount} 个机场的国际标记`);
console.log('\n部分修复的机场:');
fixedAirports.slice(0, 30).forEach(a => {
  console.log(`  ${a.code} - ${a.name} (${a.country})`);
});
if (fixedAirports.length > 30) {
  console.log(`  ... 还有 ${fixedAirports.length - 30} 个`);
}
