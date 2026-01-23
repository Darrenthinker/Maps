const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取DHL Excel文件
const filePath = path.join(__dirname, '..', 'dhl-express-remote-area-list-2025.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Total sheets:', workbook.SheetNames.length);

const result = {
  version: "2025",
  source: "DHL Express Remote Area List 2025",
  effective_date: "2025-01-05",
  us_zips: []
};

// 只从美国部分提取数据
const usZips = new Set();
let inUSSection = false;

// 找到美国数据所在的sheets（从Table 240开始）
const usSheetStart = workbook.SheetNames.findIndex(name => name === 'Table 240');
console.log('US section starts at sheet index:', usSheetStart);

for (let i = usSheetStart; i < workbook.SheetNames.length; i++) {
  const sheetName = workbook.SheetNames[i];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  for (const row of data) {
    const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
    
    // 检测美国部分开始
    if (rowStr.includes('united states') && !rowStr.includes('united states minor')) {
      inUSSection = true;
      console.log(`US section confirmed in ${sheetName}`);
    }
    
    // 检测美国部分结束
    if (inUSSection && rowStr.includes('uruguay')) {
      inUSSection = false;
      console.log(`US section ended at ${sheetName}`);
      break;
    }
    
    // 只在美国部分提取ZIP码
    if (inUSSection) {
      for (const cell of row) {
        if (cell !== undefined && cell !== null) {
          const val = String(cell).trim();
          
          // 5位ZIP码
          if (/^\d{5}$/.test(val)) {
            usZips.add(val);
          }
          // 4位数字（需要补0）- 只对以0开头的ZIP有效
          else if (/^\d{4}$/.test(val)) {
            usZips.add('0' + val);
          }
          // ZIP范围格式 "12345 - 12350"
          else if (/^\d{5}\s*-\s*\d{5}$/.test(val)) {
            const parts = val.split('-').map(p => p.trim());
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            if (end - start < 50) { // 合理的范围
              for (let z = start; z <= end; z++) {
                usZips.add(String(z).padStart(5, '0'));
              }
            }
          }
          // 4位范围格式 "1234 - 1240"
          else if (/^\d{4}\s*-\s*\d{4}$/.test(val)) {
            const parts = val.split('-').map(p => p.trim());
            const start = parseInt('0' + parts[0]);
            const end = parseInt('0' + parts[1]);
            if (end - start < 50) {
              for (let z = start; z <= end; z++) {
                usZips.add(String(z).padStart(5, '0'));
              }
            }
          }
        }
      }
    }
  }
  
  if (!inUSSection && usZips.size > 0) {
    break; // 美国部分已结束
  }
}

result.us_zips = [...usZips].sort();

console.log('\n=== Summary ===');
console.log('Total US ZIPs:', result.us_zips.length);
console.log('Sample ZIPs:', result.us_zips.slice(0, 20).join(', '));
console.log('\nBy region:');
console.log('- Northeast (01-09):', result.us_zips.filter(z => z.startsWith('0')).length);
console.log('- East (10-29):', result.us_zips.filter(z => z.startsWith('1') || z.startsWith('2')).length);
console.log('- South (30-39):', result.us_zips.filter(z => z.startsWith('3')).length);
console.log('- Midwest (40-69):', result.us_zips.filter(z => ['4','5','6'].includes(z[0])).length);
console.log('- West (70-89):', result.us_zips.filter(z => z.startsWith('7') || z.startsWith('8')).length);
console.log('- Pacific (90-96):', result.us_zips.filter(z => z.startsWith('9') && !z.startsWith('99')).length);
console.log('- Alaska (995-999):', result.us_zips.filter(z => z.startsWith('995') || z.startsWith('996') || z.startsWith('997') || z.startsWith('998') || z.startsWith('999')).length);
console.log('- Hawaii (967-968):', result.us_zips.filter(z => z.startsWith('967') || z.startsWith('968')).length);

// 保存结果
fs.writeFileSync(
  path.join(__dirname, '..', 'dhl-2025-data.json'),
  JSON.stringify(result, null, 2)
);
console.log('\nSaved to dhl-2025-data.json');
