import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORTS_PATH = path.join(ROOT, "public", "data", "ports-classified.json");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_API_KEY_HERE";

async function translateBatch(names) {
  const prompt = `请将以下港口/城市名称翻译成简体中文。只返回翻译结果，每行一个，保持与输入顺序一致。不要添加任何解释或标点符号。

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
        { role: "system", content: "你是一个专业的地名翻译专家，熟悉全球港口和城市名称的标准中文译名。" },
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
  console.log("Loading ports data...");
  const portsData = JSON.parse(fs.readFileSync(PORTS_PATH, "utf8"));
  
  // 收集所有没有中文名的港口
  const portsToTranslate = [];
  
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          if (!port.nameZh) {
            portsToTranslate.push({
              port,
              name: port.city || port.name
            });
          }
        }
      }
    }
  }
  
  console.log(`Found ${portsToTranslate.length} ports without Chinese names`);
  
  // 批量翻译，每批50个
  const BATCH_SIZE = 50;
  let translated = 0;
  let failed = 0;
  
  for (let i = 0; i < portsToTranslate.length; i += BATCH_SIZE) {
    const batch = portsToTranslate.slice(i, i + BATCH_SIZE);
    const names = batch.map(p => p.name);
    
    console.log(`\nTranslating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(portsToTranslate.length / BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, portsToTranslate.length)})...`);
    
    try {
      const translations = await translateBatch(names);
      
      // 应用翻译结果
      for (let j = 0; j < batch.length && j < translations.length; j++) {
        const zh = translations[j];
        if (zh && zh.length >= 1 && zh.length <= 30) {
          batch[j].port.nameZh = zh;
          translated++;
        }
      }
      
      console.log(`  Translated: ${translations.length} names`);
      
      // 延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 每10批保存一次
      if ((i / BATCH_SIZE + 1) % 10 === 0) {
        fs.writeFileSync(PORTS_PATH, JSON.stringify(portsData, null, 2));
        console.log("  Progress saved.");
      }
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      failed += batch.length;
      
      // 如果是API错误，等待更长时间
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 最终保存
  fs.writeFileSync(PORTS_PATH, JSON.stringify(portsData, null, 2));
  
  // 统计结果
  let withZh = 0;
  let withoutZh = 0;
  for (const continent of Object.values(portsData.continents || {})) {
    for (const region of Object.values(continent.regions || {})) {
      for (const country of Object.values(region.countries || {})) {
        for (const port of country.ports || []) {
          if (port.nameZh) withZh++;
          else withoutZh++;
        }
      }
    }
  }
  
  console.log(`\n=== Translation Complete ===`);
  console.log(`Translated: ${translated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Ports with Chinese name: ${withZh}`);
  console.log(`Ports without Chinese name: ${withoutZh}`);
  console.log(`Coverage: ${(withZh / (withZh + withoutZh) * 100).toFixed(1)}%`);
}

main().catch(console.error);
