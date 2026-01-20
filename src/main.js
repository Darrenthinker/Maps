import "./style.css";
import Fuse from "fuse.js";
import { createMapAdapter } from "./mapAdapters/index.js";

const app = document.querySelector(".app");
const searchInput = document.getElementById("searchInput");
const filterAirports = document.getElementById("filterAirports");
const filterPorts = document.getElementById("filterPorts");
const resultsCount = document.getElementById("resultsCount");
const resultsList = document.getElementById("resultsList");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarFloatingToggle = document.getElementById("sidebarFloatingToggle");

const mapAdapter = createMapAdapter("map", "leaflet");

const state = {
  allNodes: [],
  filteredNodes: [],
  fuse: null
};

// Fuse.js 配置 - 支持模糊搜索
const fuseOptions = {
  keys: [
    { name: "name", weight: 0.3 },
    { name: "city", weight: 0.25 },
    { name: "country", weight: 0.2 },
    { name: "code", weight: 0.15 },
    { name: "icao", weight: 0.1 }
  ],
  threshold: 0.3, // 模糊度，0 = 精确匹配，1 = 全匹配
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 1
};

function buildPopup(node) {
  const codeLabel = node.type === "airport" ? "IATA / ICAO" : "UN/LOCODE";
  const codeValue = node.type === "airport" ? `${node.code} / ${node.icao}` : node.code;
  return `
    <div>
      <strong>${node.name}</strong><br />
      ${node.city}, ${node.country}<br />
      ${codeLabel}: ${codeValue}
    </div>
  `;
}

function applyFilters() {
  const query = searchInput.value.trim();
  const showAirports = filterAirports.checked;
  const showPorts = filterPorts.checked;

  // 先按类型筛选
  let filtered = state.allNodes.filter((node) => {
    if (node.type === "airport" && !showAirports) return false;
    if (node.type === "port" && !showPorts) return false;
    return true;
  });

  // 如果有搜索词，使用 Fuse.js 模糊搜索
  if (query) {
    const fuse = new Fuse(filtered, fuseOptions);
    const results = fuse.search(query);
    filtered = results.map((r) => r.item);
  }

  state.filteredNodes = filtered;
  renderResults();
  
  // 只在地图上显示前 5000 个点以提高性能
  const mapNodes = filtered.slice(0, 5000);
  mapAdapter.setMarkers(mapNodes);
}

function renderResults() {
  resultsCount.textContent = String(state.filteredNodes.length);
  
  // 只渲染前 200 个结果以提高性能
  const displayNodes = state.filteredNodes.slice(0, 200);
  
  resultsList.innerHTML = displayNodes
    .map((node) => {
      const code = node.code || "";
      const sub = node.type === "airport" ? "机场" : "港口";
      return `
        <li class="result-item" data-id="${node.id}">
          <div class="result-item__title">${code} · ${node.name}</div>
          <div class="result-item__meta">${node.city}, ${node.country} · ${sub}</div>
        </li>
      `;
    })
    .join("");
    
  // 如果结果超过 200 个，显示提示
  if (state.filteredNodes.length > 200) {
    resultsList.innerHTML += `
      <li class="result-item result-item--hint">
        <div class="result-item__meta">还有 ${state.filteredNodes.length - 200} 个结果，请输入更精确的搜索词</div>
      </li>
    `;
  }
}

function wireEvents() {
  // 使用防抖优化搜索性能
  let debounceTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 150);
  });
  
  filterAirports.addEventListener("change", applyFilters);
  filterPorts.addEventListener("change", applyFilters);
  
  resultsList.addEventListener("click", (event) => {
    const item = event.target.closest(".result-item");
    if (!item || item.classList.contains("result-item--hint")) return;
    const node = state.filteredNodes.find((n) => n.id === item.dataset.id);
    if (node) {
      mapAdapter.focusOn(node);
      // 手机端点击后自动收起侧边栏
      if (window.innerWidth <= 768) {
        app.classList.add("app--collapsed");
      }
    }
  });

  const toggleSidebar = () => {
    app.classList.toggle("app--collapsed");
  };

  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarFloatingToggle.addEventListener("click", toggleSidebar);
}

async function loadData() {
  // 显示加载状态
  resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">加载数据中...</div></li>';
  
  try {
    const [airports, ports] = await Promise.all([
      fetch("/data/airports.json").then((res) => res.json()),
      fetch("/data/ports.json").then((res) => res.json())
    ]);

    const airportNodes = airports.map((airport) => ({
      ...airport,
      type: "airport",
      popupHtml: buildPopup({ ...airport, type: "airport" })
    }));

    const portNodes = ports.map((port) => ({
      ...port,
      type: "port",
      popupHtml: buildPopup({ ...port, type: "port" })
    }));

    state.allNodes = [...airportNodes, ...portNodes];
    applyFilters();
  } catch (error) {
    resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">数据加载失败，请刷新重试</div></li>';
    console.error("Failed to load data:", error);
  }
}

// 手机端默认折叠侧边栏
if (window.innerWidth <= 768) {
  app.classList.add("app--collapsed");
}

wireEvents();
loadData();
