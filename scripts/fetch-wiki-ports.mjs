import fs from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";

const converter = OpenCC.Converter({ from: "tw", to: "cn" });
const ROOT = process.cwd();
const PORTS_PATH = path.join(ROOT, "public", "data", "ports-classified.json");

// 维基百科API
const WIKI_API = "https://zh.wikipedia.org/w/api.php";

async function fetchWikiPage(title) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    format: "json",
    origin: "*"
  });
  
  const response = await fetch(`${WIKI_API}?${params}`);
  const data = await response.json();
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.revisions?.[0]?.["*"] || "";
}

async function searchWikiPages(keyword) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: keyword,
    srlimit: 20,
    format: "json",
    origin: "*"
  });
  
  const response = await fetch(`${WIKI_API}?${params}`);
  const data = await response.json();
  return data?.query?.search || [];
}

// 从维基百科获取港口相关页面
async function main() {
  console.log("Searching Wikipedia for port-related pages...\n");
  
  // 搜索港口列表相关页面
  const searches = [
    "世界港口列表",
    "港口列表",
    "中国港口",
    "美国港口",
    "欧洲港口"
  ];
  
  for (const keyword of searches) {
    console.log(`\nSearching: ${keyword}`);
    const results = await searchWikiPages(keyword);
    for (const r of results.slice(0, 5)) {
      console.log(`  - ${r.title}`);
    }
  }
  
  // 尝试获取一个具体的港口列表页面
  console.log("\n\n--- Fetching specific port list page ---");
  const portListPages = [
    "世界最繁忙港口列表",
    "中华人民共和国港口列表"
  ];
  
  for (const pageName of portListPages) {
    console.log(`\nFetching: ${pageName}`);
    const content = await fetchWikiPage(pageName);
    if (content) {
      console.log(`Content length: ${content.length} chars`);
      // 打印前1000个字符查看结构
      console.log("Preview:", content.substring(0, 1500));
    } else {
      console.log("Page not found");
    }
  }
}

main().catch(console.error);
