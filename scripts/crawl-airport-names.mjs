/**
 * 爬取机场/港口中文名称
 * 优先级：Wikidata > 5688.com.cn > seabay.cn > 规则翻译
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 延迟函数（毫秒）
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 爬取 5688.com.cn 机场数据
async function crawl5688Airports() {
  console.log('正在爬取 5688.com.cn 机场数据...');
  
  const results = {};
  
  // 机场代码字母列表
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  for (const letter of letters) {
    try {
      const url = `https://www.5688.com.cn/airport/${letter}`;
      console.log(`  爬取: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });
      
      if (!response.ok) {
        console.log(`    跳过 (HTTP ${response.status})`);
        await delay(1000);
        continue;
      }
      
      const html = await response.text();
      
      // 解析表格数据
      // 格式: <td>城市英文中文</td><td>代码</td><td>机场名英文中文</td><td>国家</td>
      const tableRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<\/tr>/gi;
      
      let match;
      let count = 0;
      while ((match = tableRegex.exec(html)) !== null) {
        const cityCell = match[1].replace(/<[^>]+>/g, '').trim();
        const codeCell = match[2].replace(/<[^>]+>/g, '').trim();
        const airportCell = match[3].replace(/<[^>]+>/g, '').trim();
        const countryCell = match[4].replace(/<[^>]+>/g, '').trim();
        
        // 提取三字代码（去掉"城市"标签）
        const codeMatch = codeCell.match(/^([A-Z]{3})/);
        if (!codeMatch) continue;
        const code = codeMatch[1];
        
        // 提取中文机场名（在英文名后面）
        const airportZhMatch = airportCell.match(/[A-Za-z\s\-\.]+\s*(.+)/);
        const airportZh = airportZhMatch ? airportZhMatch[1].trim() : null;
        
        // 提取城市中文名
        const cityZhMatch = cityCell.match(/[A-Za-z\s\-]+(.+)/);
        const cityZh = cityZhMatch ? cityZhMatch[1].trim() : null;
        
        if (code && (airportZh || cityZh)) {
          results[code] = {
            code,
            airportZh: airportZh || null,
            cityZh: cityZh || null,
            country: countryCell
          };
          count++;
        }
      }
      
      console.log(`    获取 ${count} 条数据`);
      
      // 低频爬取：每次请求间隔 1.5 秒
      await delay(1500);
      
    } catch (error) {
      console.log(`    错误: ${error.message}`);
      await delay(2000);
    }
  }
  
  console.log(`5688.com.cn 总计获取: ${Object.keys(results).length} 条`);
  return results;
}

// 爬取 seabay.cn 机场数据（需要处理验证码）
async function crawlSeabayAirports() {
  console.log('正在尝试爬取 seabay.cn...');
  
  // 测试是否需要验证码
  try {
    const testUrl = 'https://www.seabay.cn/cn/code/s_美国_1.html';
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    
    const html = await response.text();
    
    if (html.includes('人机验证') || html.includes('验证码') || html.includes('captcha')) {
      console.log('⚠️ seabay.cn 需要人机验证，跳过此数据源');
      console.log('  如需使用此数据源，请手动访问网站完成验证后通知我');
      return {};
    }
    
    // 如果没有验证码，继续爬取
    console.log('  seabay.cn 可以访问，开始爬取...');
    // TODO: 实现具体爬取逻辑
    
  } catch (error) {
    console.log(`  seabay.cn 访问失败: ${error.message}`);
  }
  
  return {};
}

// 合并数据到分类文件
async function mergeToClassifiedData(crawledData) {
  console.log('\n正在合并数据到分类文件...');
  
  // 读取机场分类数据
  const airportsPath = path.join(__dirname, '../public/data/airports-classified.json');
  const airportsData = JSON.parse(fs.readFileSync(airportsPath, 'utf-8'));
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  // 遍历所有机场
  for (const continent of Object.values(airportsData.continents)) {
    for (const region of Object.values(continent.regions)) {
      for (const country of Object.values(region.countries)) {
        for (const airport of country.airports) {
          const code = airport.code || airport.iata;
          
          // 如果已有 Wikidata 的中文名，跳过
          if (airport.nameZh && airport.nameZh.length > 0) {
            skippedCount++;
            continue;
          }
          
          // 查找爬取的数据
          if (crawledData[code]) {
            const crawled = crawledData[code];
            // 优先使用机场中文名，否则用城市中文名+机场
            if (crawled.airportZh) {
              airport.nameZh = crawled.airportZh;
              updatedCount++;
            } else if (crawled.cityZh) {
              airport.nameZh = crawled.cityZh + '机场';
              updatedCount++;
            }
          }
        }
      }
    }
  }
  
  // 保存更新后的数据
  fs.writeFileSync(airportsPath, JSON.stringify(airportsData, null, 2));
  
  console.log(`合并完成:`);
  console.log(`  - 更新: ${updatedCount} 条`);
  console.log(`  - 跳过(已有Wikidata数据): ${skippedCount} 条`);
}

// 主函数
async function main() {
  console.log('=== 机场中文名爬取工具 ===\n');
  console.log('优先级: Wikidata > 5688.com.cn > seabay.cn\n');
  
  // 1. 爬取 5688.com.cn
  const data5688 = await crawl5688Airports();
  
  // 2. 尝试爬取 seabay.cn
  const dataSeabay = await crawlSeabayAirports();
  
  // 3. 合并数据（5688 优先，因为 seabay 需要验证码）
  const mergedData = { ...dataSeabay, ...data5688 };
  
  // 4. 保存爬取的原始数据（备份）
  const backupPath = path.join(__dirname, '../data/raw/crawled-airport-names.json');
  fs.writeFileSync(backupPath, JSON.stringify(mergedData, null, 2));
  console.log(`\n原始数据已保存到: ${backupPath}`);
  
  // 5. 合并到分类数据
  await mergeToClassifiedData(mergedData);
  
  console.log('\n✅ 爬取完成！');
}

main().catch(console.error);
