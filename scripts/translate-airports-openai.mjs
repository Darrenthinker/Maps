import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AIRPORTS_PATH = path.join(ROOT, "public", "data", "airports-classified.json");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_API_KEY_HERE";

async function translateBatch(names) {
  const prompt = `请将以下机场/空军基地名称翻译成简体中文。只返回翻译结果，每行一个，保持与输入顺序一致。不要添加任何解释或标点符号。

${names.join("\n")}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "你是一个专业的地名翻译专家，熟悉全球机场和空军基地名称的标准中文译名。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.split("\n").map(s => s.trim()).filter(Boolean);
}

async function main() {
  console.log("Loading airports data...");
  const airportsData = JSON.parse(fs.readFileSync(AIRPORTS_PATH, "utf8"));
  
  // 收集所有没有中文名的机场
  const airportsToTranslate = [];
  
  for (const continent of Object.values(airportsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const airport of country.airports || []) {
          if (!airport.nameZh) {
            airportsToTranslate.push({
              airport,
              name: airport.name
            });
          }
        }
      }
    }
  }
  
  console.log(`Found ${airportsToTranslate.length} airports without Chinese names`);
  
  if (airportsToTranslate.length === 0) {
    console.log("All airports already have Chinese names!");
    return;
  }
  
  // 批量翻译，每批50个
  const BATCH_SIZE = 50;
  let translated = 0;
  
  for (let i = 0; i < airportsToTranslate.length; i += BATCH_SIZE) {
    const batch = airportsToTranslate.slice(i, i + BATCH_SIZE);
    const names = batch.map(p => p.name);
    
    console.log(`\nTranslating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(airportsToTranslate.length / BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, airportsToTranslate.length)})...`);
    
    try {
      const translations = await translateBatch(names);
      
      // 应用翻译结果
      for (let j = 0; j < batch.length && j < translations.length; j++) {
        const zh = translations[j];
        if (zh && zh.length >= 1 && zh.length <= 50) {
          batch[j].airport.nameZh = zh;
          translated++;
        }
      }
      
      console.log(`  Translated: ${translations.length} names`);
      
      // 延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 保存
  fs.writeFileSync(AIRPORTS_PATH, JSON.stringify(airportsData, null, 2));
  
  // 统计结果
  let withZh = 0;
  let withoutZh = 0;
  for (const continent of Object.values(airportsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const airport of country.airports || []) {
          if (airport.nameZh) withZh++;
          else withoutZh++;
        }
      }
    }
  }
  
  console.log(`\n=== Translation Complete ===`);
  console.log(`Translated: ${translated}`);
  console.log(`Airports with Chinese name: ${withZh}`);
  console.log(`Airports without Chinese name: ${withoutZh}`);
  console.log(`Coverage: ${(withZh / (withZh + withoutZh) * 100).toFixed(1)}%`);
}

main().catch(console.error);
