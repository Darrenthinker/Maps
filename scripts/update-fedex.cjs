const fs = require('fs');
const path = require('path');

// 读取FedEx数据
const fedexData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fedex-2025-data.json'), 'utf8'));

// 读取现有remote-areas.json
const remoteAreasPath = path.join(__dirname, '..', 'public', 'data', 'remote-areas.json');
const remoteAreas = JSON.parse(fs.readFileSync(remoteAreasPath, 'utf8'));

// 更新FedEx数据
remoteAreas.fedex = {
  name: "FedEx",
  surcharge_name: "Delivery Area Surcharge (DAS)",
  data_effective: "2025-06-02",
  data_source: "FedEx Official DAS_Contiguous_Extended_Remote_Alaska_Hawaii_2025",
  
  // 美国本土DAS
  das_zips: fedexData.contiguous_us,
  
  // 美国本土DAS Extended
  das_extended_zips: fedexData.contiguous_extended,
  
  // 美国本土偏远
  remote_zips: fedexData.contiguous_remote,
  
  // 阿拉斯加
  alaska_zips: fedexData.alaska,
  
  // 夏威夷
  hawaii_zips: fedexData.hawaii,
  
  // 夏威夷岛内
  intra_hawaii_zips: fedexData.intra_hawaii,
  
  // 所有偏远ZIP（用于快速查询）
  all_remote_zips: fedexData.all_zips
};

// 保存更新后的文件
fs.writeFileSync(remoteAreasPath, JSON.stringify(remoteAreas, null, 2));

console.log('Updated remote-areas.json with FedEx 2025 data');
console.log('FedEx DAS ZIPs:', remoteAreas.fedex.das_zips.length);
console.log('FedEx DAS Extended ZIPs:', remoteAreas.fedex.das_extended_zips.length);
console.log('FedEx Remote ZIPs:', remoteAreas.fedex.remote_zips.length);
console.log('FedEx Alaska ZIPs:', remoteAreas.fedex.alaska_zips.length);
console.log('FedEx Hawaii ZIPs:', remoteAreas.fedex.hawaii_zips.length);
console.log('FedEx Intra-Hawaii ZIPs:', remoteAreas.fedex.intra_hawaii_zips.length);
console.log('FedEx Total Unique ZIPs:', remoteAreas.fedex.all_remote_zips.length);
