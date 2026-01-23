const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取FedEx Excel文件
const filePath = path.join(__dirname, '..', 'DAS_Contiguous_Extended_Remote_Alaska_Hawaii_2025  FEDEX.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

const result = {
  version: "2025-06-02",
  source: "FedEx Official - Effective June 2, 2025",
  contiguous_us: [],        // Contiguous U.S. DAS
  contiguous_extended: [],  // Contiguous U.S. Extended
  contiguous_remote: [],    // Contiguous U.S. Remote
  alaska: [],               // Alaska
  hawaii: [],               // Hawaii
  intra_hawaii: []          // Intra-Hawaii
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
        else if (/^\d+$/.test(val) && val.length < 5 && val.length >= 3) {
          zips.push(val.padStart(5, '0'));
        }
      }
    }
  }
  
  return [...new Set(zips)].sort();
}

// 提取每个sheet的数据 - 按照实际sheet名称匹配
workbook.SheetNames.forEach((sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const zips = extractZips(sheet);
  
  console.log(`\n${sheetName}: ${zips.length} ZIP codes`);
  console.log('Sample:', zips.slice(0, 10).join(', '));
  
  // 根据实际sheet名称分类
  if (sheetName === 'DAS_ContUS') {
    result.contiguous_us = zips;
  } else if (sheetName === 'DAS_ContUSExt') {
    result.contiguous_extended = zips;
  } else if (sheetName === 'DAS_ContUSRem') {
    result.contiguous_remote = zips;
  } else if (sheetName === 'DAS_Alaska') {
    result.alaska = zips;
  } else if (sheetName === 'DAS_Hawaii') {
    result.hawaii = zips;
  } else if (sheetName === 'DAS_IntraHawaii') {
    result.intra_hawaii = zips;
  }
});

// 合并所有ZIP到一个数组
const allZips = [
  ...result.contiguous_us,
  ...result.contiguous_extended,
  ...result.contiguous_remote,
  ...result.alaska,
  ...result.hawaii,
  ...result.intra_hawaii
];
result.all_zips = [...new Set(allZips)].sort();

console.log('\n=== Summary ===');
console.log('Contiguous US DAS:', result.contiguous_us.length);
console.log('Contiguous US Extended:', result.contiguous_extended.length);
console.log('Contiguous US Remote:', result.contiguous_remote.length);
console.log('Alaska:', result.alaska.length);
console.log('Hawaii:', result.hawaii.length);
console.log('Intra-Hawaii:', result.intra_hawaii.length);
console.log('Total unique:', result.all_zips.length);

// 保存结果
fs.writeFileSync(
  path.join(__dirname, '..', 'fedex-2025-data.json'),
  JSON.stringify(result, null, 2)
);
console.log('\nSaved to fedex-2025-data.json');
