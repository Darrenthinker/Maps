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

// 地址搜索相关元素
const tabHubs = document.getElementById("tabHubs");
const tabAddress = document.getElementById("tabAddress");
const hubSearch = document.getElementById("hubSearch");
const addressSearch = document.getElementById("addressSearch");
const addressInput = document.getElementById("addressInput");
const addressSearchBtn = document.getElementById("addressSearchBtn");
const addressResult = document.getElementById("addressResult");

const mapAdapter = createMapAdapter("map", "leaflet");

const state = {
  allNodes: [],
  filteredNodes: [],
  addressMarker: null
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
  threshold: 0.3,
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

// 计算两点之间的距离（公里）
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 查找附近的机场/港口
function findNearby(lat, lng, limit = 5) {
  const withDistance = state.allNodes.map(node => ({
    ...node,
    distance: getDistance(lat, lng, node.lat, node.lng)
  }));
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, limit);
}

// 使用 Nominatim API 搜索地址
async function searchAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "zh-CN,zh,en",
        "User-Agent": "GlobalHubMap/1.0"
      }
    });
    
    if (!response.ok) throw new Error("API request failed");
    
    const data = await response.json();
    if (data.length === 0) return null;
    
    return {
      name: data[0].display_name,
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    };
  } catch (error) {
    console.error("Address search error:", error);
    return null;
  }
}

// 处理地址搜索
async function handleAddressSearch() {
  const query = addressInput.value.trim();
  if (!query) return;
  
  addressSearchBtn.disabled = true;
  addressSearchBtn.textContent = "搜索中...";
  addressResult.className = "address-result";
  
  try {
    const result = await searchAddress(query);
    
    if (!result) {
      addressResult.innerHTML = '<div class="address-result__title">未找到该地址，请尝试其他关键词</div>';
      addressResult.className = "address-result address-result--visible";
      return;
    }
    
    // 在地图上显示位置
    mapAdapter.focusOnCoords(result.lat, result.lng, 10);
    
    // 查找附近的机场/港口
    const nearby = findNearby(result.lat, result.lng, 5);
    
    // 显示结果
    let html = `
      <div class="address-result__title">📍 ${result.name}</div>
      <div class="address-result__coords">经纬度: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}</div>
    `;
    
    if (nearby.length > 0) {
      html += `
        <div class="address-result__nearby">
          <div class="address-result__nearby-title">📦 附近的机场/港口：</div>
          ${nearby.map(node => `
            <div class="address-result__nearby-item" data-id="${node.id}">
              ${node.type === "airport" ? "✈️" : "🚢"} ${node.code} · ${node.name}
              <span style="color: #64748b; font-size: 11px;">(${node.distance.toFixed(0)} km)</span>
            </div>
          `).join("")}
        </div>
      `;
    }
    
    addressResult.innerHTML = html;
    addressResult.className = "address-result address-result--visible";
    
    // 绑定附近项点击事件
    addressResult.querySelectorAll(".address-result__nearby-item").forEach(item => {
      item.addEventListener("click", () => {
        const node = state.allNodes.find(n => n.id === item.dataset.id);
        if (node) {
          mapAdapter.focusOn(node);
          if (window.innerWidth <= 768) {
            app.classList.add("app--collapsed");
          }
        }
      });
    });
    
  } finally {
    addressSearchBtn.disabled = false;
    addressSearchBtn.textContent = "搜索地址";
  }
}

function applyFilters() {
  const query = searchInput.value.trim();
  const showAirports = filterAirports.checked;
  const showPorts = filterPorts.checked;

  let filtered = state.allNodes.filter((node) => {
    if (node.type === "airport" && !showAirports) return false;
    if (node.type === "port" && !showPorts) return false;
    return true;
  });

  if (query) {
    const fuse = new Fuse(filtered, fuseOptions);
    const results = fuse.search(query);
    filtered = results.map((r) => r.item);
  }

  state.filteredNodes = filtered;
  renderResults();
  
  const mapNodes = filtered.slice(0, 5000);
  mapAdapter.setMarkers(mapNodes);
}

function renderResults() {
  resultsCount.textContent = String(state.filteredNodes.length);
  
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
    
  if (state.filteredNodes.length > 200) {
    resultsList.innerHTML += `
      <li class="result-item result-item--hint">
        <div class="result-item__meta">还有 ${state.filteredNodes.length - 200} 个结果，请输入更精确的搜索词</div>
      </li>
    `;
  }
}

function wireEvents() {
  // 标签切换
  tabHubs.addEventListener("click", () => {
    tabHubs.classList.add("search-tab--active");
    tabAddress.classList.remove("search-tab--active");
    hubSearch.classList.remove("search-panel--hidden");
    addressSearch.classList.add("search-panel--hidden");
  });
  
  tabAddress.addEventListener("click", () => {
    tabAddress.classList.add("search-tab--active");
    tabHubs.classList.remove("search-tab--active");
    addressSearch.classList.remove("search-panel--hidden");
    hubSearch.classList.add("search-panel--hidden");
  });
  
  // 地址搜索
  addressSearchBtn.addEventListener("click", handleAddressSearch);
  addressInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddressSearch();
  });
  
  // 机场/港口搜索
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

if (window.innerWidth <= 768) {
  app.classList.add("app--collapsed");
}

wireEvents();
loadData();
