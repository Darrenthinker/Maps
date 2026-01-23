const fs = require('fs');
const path = require('path');

// 读取DHL数据
const dhlData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dhl-2025-data.json'), 'utf8'));

// 读取现有remote-areas.json
const remoteAreasPath = path.join(__dirname, '..', 'public', 'data', 'remote-areas.json');
const remoteAreas = JSON.parse(fs.readFileSync(remoteAreasPath, 'utf8'));

// 分类DHL ZIP码
const alaskaZips = dhlData.us_zips.filter(z => 
  z.startsWith('995') || z.startsWith('996') || z.startsWith('997') || z.startsWith('998') || z.startsWith('999')
);
const hawaiiZips = dhlData.us_zips.filter(z => z.startsWith('967') || z.startsWith('968'));
const continentalZips = dhlData.us_zips.filter(z => 
  !z.startsWith('995') && !z.startsWith('996') && !z.startsWith('997') && 
  !z.startsWith('998') && !z.startsWith('999') && !z.startsWith('967') && !z.startsWith('968')
);

// 更新DHL数据
remoteAreas.dhl = {
  name: "DHL",
  surcharge_name: "Remote Area Surcharge",
  data_effective: "2025-01-05",
  data_source: "DHL Express Remote Area List 2025 (Official PDF/Excel)",
  
  // 美国本土偏远
  continental_zips: continentalZips,
  
  // 阿拉斯加
  alaska_zips: alaskaZips,
  
  // 夏威夷
  hawaii_zips: hawaiiZips,
  
  // 所有偏远ZIP（用于快速查询）
  all_remote_zips: dhlData.us_zips
};

// 保存更新后的文件
fs.writeFileSync(remoteAreasPath, JSON.stringify(remoteAreas, null, 2));

console.log('Updated remote-areas.json with DHL 2025 data');
console.log('DHL Continental US ZIPs:', remoteAreas.dhl.continental_zips.length);
console.log('DHL Alaska ZIPs:', remoteAreas.dhl.alaska_zips.length);
console.log('DHL Hawaii ZIPs:', remoteAreas.dhl.hawaii_zips.length);
console.log('DHL Total US ZIPs:', remoteAreas.dhl.all_remote_zips.length);
