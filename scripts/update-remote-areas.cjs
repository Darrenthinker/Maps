const fs = require('fs');
const path = require('path');

// 读取UPS数据
const upsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ups-2025-data.json'), 'utf8'));

// 读取现有remote-areas.json
const remoteAreasPath = path.join(__dirname, '..', 'public', 'data', 'remote-areas.json');
const remoteAreas = JSON.parse(fs.readFileSync(remoteAreasPath, 'utf8'));

// 更新UPS数据
remoteAreas.version = "2025-01-23";
remoteAreas.last_updated = "2025-01-23";

remoteAreas.ups = {
  name: "UPS",
  surcharge_name: "Extended Area Surcharge / DAS",
  data_effective: "2025-06-01",
  data_source: "UPS Official area_surcharge_zips_us 2025",
  
  // 美国本土DAS区域
  das_zips: upsData.us48_das,
  
  // 美国本土DAS Extended区域
  das_extended_zips: upsData.us48_das_extended,
  
  // 夏威夷偏远
  hawaii_remote_zips: upsData.hawaii,
  
  // 阿拉斯加偏远
  alaska_remote_zips: upsData.alaska,
  
  // 美国本土偏远
  us48_remote_zips: upsData.us48_remote,
  
  // 所有偏远ZIP（用于快速查询）
  all_remote_zips: upsData.all_zips
};

// 保存更新后的文件
fs.writeFileSync(remoteAreasPath, JSON.stringify(remoteAreas, null, 2));

console.log('Updated remote-areas.json with UPS 2025 data');
console.log('UPS DAS ZIPs:', remoteAreas.ups.das_zips.length);
console.log('UPS DAS Extended ZIPs:', remoteAreas.ups.das_extended_zips.length);
console.log('UPS Hawaii Remote ZIPs:', remoteAreas.ups.hawaii_remote_zips.length);
console.log('UPS Alaska Remote ZIPs:', remoteAreas.ups.alaska_remote_zips.length);
console.log('UPS US48 Remote ZIPs:', remoteAreas.ups.us48_remote_zips.length);
console.log('UPS Total Unique ZIPs:', remoteAreas.ups.all_remote_zips.length);
