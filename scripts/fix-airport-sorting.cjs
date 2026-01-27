/**
 * 修复机场排序 - 确保国际机场排在国内机场前面
 * 排序规则：
 * 1. 国际机场优先 (intl: 1)
 * 2. 同类型内按重要性排序（保持原有顺序，假设原有顺序已考虑吞吐量等因素）
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/data/airports-classified.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let totalFixed = 0;
let countriesFixed = [];

// 遍历所有大洲 -> 区域 -> 国家
for (const [contCode, continent] of Object.entries(data.continents)) {
  for (const [regCode, region] of Object.entries(continent.regions)) {
    for (const [countryCode, country] of Object.entries(region.countries)) {
      if (!country.airports || country.airports.length === 0) continue;
      
      const originalOrder = country.airports.map(a => a.code).join(',');
      
      // 分离国际和国内机场
      const intlAirports = country.airports.filter(a => a.intl === 1);
      const domesticAirports = country.airports.filter(a => a.intl !== 1);
      
      // 检查是否需要修复（国内机场是否出现在国际机场前面）
      let needsFix = false;
      let firstDomesticIndex = country.airports.findIndex(a => a.intl !== 1);
      let lastIntlIndex = -1;
      for (let i = country.airports.length - 1; i >= 0; i--) {
        if (country.airports[i].intl === 1) {
          lastIntlIndex = i;
          break;
        }
      }
      
      if (firstDomesticIndex !== -1 && lastIntlIndex !== -1 && firstDomesticIndex < lastIntlIndex) {
        needsFix = true;
      }
      
      if (needsFix) {
        // 重新排序：国际机场在前，国内机场在后
        country.airports = [...intlAirports, ...domesticAirports];
        
        const newOrder = country.airports.map(a => a.code).join(',');
        
        console.log(`\n${country.name} (${countryCode}):`);
        console.log(`  国际机场: ${intlAirports.length}, 国内机场: ${domesticAirports.length}`);
        console.log(`  修复前前5: ${originalOrder.split(',').slice(0, 5).join(', ')}`);
        console.log(`  修复后前5: ${newOrder.split(',').slice(0, 5).join(', ')}`);
        
        totalFixed++;
        countriesFixed.push(`${country.name} (${countryCode})`);
      }
    }
  }
}

// 保存修复后的数据
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log(`\n========================================`);
console.log(`修复完成！共修复 ${totalFixed} 个国家的机场排序`);
if (countriesFixed.length > 0) {
  console.log(`修复的国家: ${countriesFixed.join(', ')}`);
}
