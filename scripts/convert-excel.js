const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取UPS Excel文件
const filePath = path.join(__dirname, '..', 'area_surcharge_zips_us 2025 UPS.xlsx');
const workbook = XLSX.readFile(filePath);

// 获取所有sheet名称
console.log('Sheet names:', workbook.SheetNames);

// 读取第一个sheet
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// 转换为JSON
const data = XLSX.utils.sheet_to_json(sheet);

console.log('Total rows:', data.length);
console.log('First 5 rows:', JSON.stringify(data.slice(0, 5), null, 2));
console.log('Column headers:', Object.keys(data[0] || {}));

// 提取ZIP codes
const zipCodes = data.map(row => {
  // 尝试不同的列名
  return row['ZIP'] || row['Zip'] || row['zip'] || row['ZIP Code'] || row['Zip Code'] || row['ZIPCODE'] || Object.values(row)[0];
}).filter(zip => zip && /^\d{5}$/.test(String(zip).trim()));

console.log('\nExtracted ZIP codes count:', zipCodes.length);
console.log('Sample ZIPs:', zipCodes.slice(0, 20));

// 保存为JSON
fs.writeFileSync(
  path.join(__dirname, '..', 'ups-raw-data.json'),
  JSON.stringify({ zips: zipCodes, rawData: data.slice(0, 10) }, null, 2)
);
console.log('\nSaved to ups-raw-data.json');
