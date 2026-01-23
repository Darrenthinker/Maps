const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取UPS Excel文件
const filePath = path.join(__dirname, '..', 'area_surcharge_zips_us 2025 UPS.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

const result = {
  version: "2025-01-01",
  source: "UPS Official - Effective June 1, 2025",
  us48_das: [],           // US 48 Zip - DAS区域
  us48_das_extended: [],  // US 48 Zip DAS Extended
  hawaii: [],             // Remote HI Zip
  alaska: [],             // Remote AK Zip
  us48_remote: []         // Remote US 48 Zip
};

// 辅助函数：从sheet提取所有5位ZIP码
function extractZips(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const zips = [];
  
  for (const row of data) {
    for (const cell of row) {
      if (cell !== undefined && cell !== null) {
        const val = String(cell).trim();
        // 检查是否是5位数字（ZIP码）
        if (/^\d{5}$/.test(val)) {
          zips.push(val);
        }
        // 检查是否是4位数字（需要补0）
        else if (/^\d{4}$/.test(val)) {
          zips.push('0' + val);
        }
        // 检查是否是数字但不是5位
        else if (/^\d+$/.test(val) && val.length < 5) {
          zips.push(val.padStart(5, '0'));
        }
      }
    }
  }
  
  return [...new Set(zips)].sort();
}

// 提取每个sheet的数据
workbook.SheetNames.forEach((sheetName, index) => {
  const sheet = workbook.Sheets[sheetName];
  const zips = extractZips(sheet);
  
  console.log(`\n${sheetName}: ${zips.length} ZIP codes`);
  console.log('Sample:', zips.slice(0, 10).join(', '));
  
  if (sheetName.includes('US 48 Zip') && sheetName.includes('DAS Extended')) {
    result.us48_das_extended = zips;
  } else if (sheetName.includes('US 48 Zip') && !sheetName.includes('Remote')) {
    result.us48_das = zips;
  } else if (sheetName.includes('Remote HI')) {
    result.hawaii = zips;
  } else if (sheetName.includes('Remote AK')) {
    result.alaska = zips;
  } else if (sheetName.includes('Remote US 48')) {
    result.us48_remote = zips;
  }
});

// 合并所有ZIP到一个数组
const allZips = [
  ...result.us48_das,
  ...result.us48_das_extended,
  ...result.hawaii,
  ...result.alaska,
  ...result.us48_remote
];
result.all_zips = [...new Set(allZips)].sort();

console.log('\n=== Summary ===');
console.log('US 48 DAS:', result.us48_das.length);
console.log('US 48 DAS Extended:', result.us48_das_extended.length);
console.log('Hawaii:', result.hawaii.length);
console.log('Alaska:', result.alaska.length);
console.log('US 48 Remote:', result.us48_remote.length);
console.log('Total unique:', result.all_zips.length);

// 保存结果
fs.writeFileSync(
  path.join(__dirname, '..', 'ups-2025-data.json'),
  JSON.stringify(result, null, 2)
);
console.log('\nSaved to ups-2025-data.json');
