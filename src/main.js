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

// ========== 自定义地址搜索（通过服务端代理，无需VPN） ==========

let autocompleteDebounce = null;
let autocompleteDropdown = null;

// 创建自动补全下拉框
function createAutocompleteDropdown() {
  if (autocompleteDropdown) return;
  
  autocompleteDropdown = document.createElement("div");
  autocompleteDropdown.className = "autocomplete-dropdown";
  autocompleteDropdown.style.display = "none";
  addressInput.parentNode.appendChild(autocompleteDropdown);
}

// 显示自动补全建议
function showAutocompleteSuggestions(predictions) {
  if (!predictions || predictions.length === 0) {
    autocompleteDropdown.style.display = "none";
    return;
  }
  
  autocompleteDropdown.innerHTML = predictions.map((p, index) => `
    <div class="autocomplete-item" data-place-id="${p.place_id}" data-index="${index}">
      <span class="autocomplete-item__icon">📍</span>
      <span class="autocomplete-item__text">${p.description}</span>
    </div>
  `).join("");
  
  autocompleteDropdown.style.display = "block";
  
  // 绑定点击事件
  autocompleteDropdown.querySelectorAll(".autocomplete-item").forEach(item => {
    item.addEventListener("click", () => {
      selectPlace(item.dataset.placeId, item.querySelector(".autocomplete-item__text").textContent);
    });
  });
}

// 获取自动补全建议（通过代理）
async function fetchAutocompleteSuggestions(input) {
  if (!input || input.trim().length < 2) {
    autocompleteDropdown.style.display = "none";
    return;
  }
  
  try {
    const response = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(input)}`);
    const data = await response.json();
    
    if (data.status === "OK" && data.predictions) {
      showAutocompleteSuggestions(data.predictions);
    } else if (data.status === "ZERO_RESULTS") {
      autocompleteDropdown.innerHTML = '<div class="autocomplete-item autocomplete-item--empty">未找到匹配地址</div>';
      autocompleteDropdown.style.display = "block";
    } else {
      console.warn("Autocomplete error:", data.status);
      autocompleteDropdown.style.display = "none";
    }
  } catch (error) {
    console.error("Failed to fetch autocomplete:", error);
    autocompleteDropdown.style.display = "none";
  }
}

// 选择地点并获取详情
async function selectPlace(placeId, description) {
  // 先更新输入框并隐藏下拉框
  addressInput.value = description;
  autocompleteDropdown.style.display = "none";
  
  // 显示加载状态
  addressResult.innerHTML = '<div class="address-result__title">🔄 获取位置信息...</div>';
  addressResult.className = "address-result address-result--visible";
  
  try {
    const response = await fetch(`/api/places-details?place_id=${encodeURIComponent(placeId)}`);
    const data = await response.json();
    
    if (data.status === "OK" && data.result) {
      const place = data.result;
      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      const name = place.formatted_address || place.name;
      
      // 在地图上显示位置
      mapAdapter.focusOnCoords(lat, lng, 12);
      
      // 查找附近的机场/港口
      const nearby = findNearby(lat, lng, 5);
      
      // 显示结果
      let html = `
        <div class="address-result__title">📍 ${name}</div>
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
    } else {
      addressResult.innerHTML = '<div class="address-result__title">❌ 获取位置信息失败</div>';
    }
  } catch (error) {
    console.error("Failed to fetch place details:", error);
    addressResult.innerHTML = '<div class="address-result__title">❌ 网络错误，请重试</div>';
  }
}

// 初始化地址搜索
function initAddressSearch() {
  createAutocompleteDropdown();
  
  // 输入事件 - 带防抖
  addressInput.addEventListener("input", () => {
    clearTimeout(autocompleteDebounce);
    autocompleteDebounce = setTimeout(() => {
      fetchAutocompleteSuggestions(addressInput.value);
    }, 300); // 300ms 防抖，减少请求频率
  });
  
  // 聚焦时如果有内容也显示建议
  addressInput.addEventListener("focus", () => {
    if (addressInput.value.trim().length >= 2) {
      fetchAutocompleteSuggestions(addressInput.value);
    }
  });
  
  // 点击外部关闭下拉框
  document.addEventListener("click", (e) => {
    if (!addressInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.style.display = "none";
    }
  });
  
  // 键盘导航
  let selectedIndex = -1;
  addressInput.addEventListener("keydown", (e) => {
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item:not(.autocomplete-item--empty)");
    if (items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      selectPlace(item.dataset.placeId, item.querySelector(".autocomplete-item__text").textContent);
      selectedIndex = -1;
    } else if (e.key === "Escape") {
      autocompleteDropdown.style.display = "none";
      selectedIndex = -1;
    }
  });
  
  function updateSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle("autocomplete-item--selected", i === selectedIndex);
    });
  }
}

// ========== 机场/港口搜索 ==========

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

const resultsSection = document.querySelector(".results");

function wireEvents() {
  // 标签切换
  tabHubs.addEventListener("click", () => {
    tabHubs.classList.add("search-tab--active");
    tabAddress.classList.remove("search-tab--active");
    hubSearch.classList.remove("search-panel--hidden");
    addressSearch.classList.add("search-panel--hidden");
    resultsSection.style.display = "flex"; // 显示机场/港口列表
  });
  
  tabAddress.addEventListener("click", () => {
    tabAddress.classList.add("search-tab--active");
    tabHubs.classList.remove("search-tab--active");
    addressSearch.classList.remove("search-panel--hidden");
    hubSearch.classList.add("search-panel--hidden");
    resultsSection.style.display = "none"; // 隐藏机场/港口列表
  });
  
  // 初始化地址搜索（使用服务端代理）
  initAddressSearch();
  
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
