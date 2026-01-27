import "./style.css";
import Fuse from "fuse.js";
import { createMapAdapter } from "./mapAdapters/index.js";

const app = document.querySelector(".app");
const searchInput = document.getElementById("searchInput");
const searchSuggestions = document.getElementById("searchSuggestions");
const resultsCount = document.getElementById("resultsCount");
const resultsList = document.getElementById("resultsList");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarFloatingToggle = document.getElementById("sidebarFloatingToggle");

// 机场/港口/海外仓 Tab
const tabAirports = document.getElementById("tabAirports");
const tabPorts = document.getElementById("tabPorts");
const tabWarehouses = document.getElementById("tabWarehouses");
const airportsCountEl = document.getElementById("airportsCount");
const portsCountEl = document.getElementById("portsCount");
const warehousesCountEl = document.getElementById("warehousesCount");

// 地址搜索相关元素
const tabHubs = document.getElementById("tabHubs");
const tabAddress = document.getElementById("tabAddress");
const hubSearch = document.getElementById("hubSearch");
const addressSearch = document.getElementById("addressSearch");
const addressInput = document.getElementById("addressInput");
const addressResult = document.getElementById("addressResult");

// 两地距离相关元素
const toggleDistanceBtn = document.getElementById("toggleDistanceBtn");
const closeDistanceBtn = document.getElementById("closeDistanceBtn");
const addressInputBRow = document.getElementById("addressInputB");
const addressInputB = document.getElementById("addressInputB_field");
const distanceResult = document.getElementById("distanceResult");

const mapAdapter = createMapAdapter("map", "leaflet");

const state = {
  allNodes: [],
  filteredNodes: [],
  addressMarker: null,
  // 两地距离状态
  distanceMode: false,
  pointA: null, // { lat, lng, name }
  pointB: null,  // { lat, lng, name }
  // 偏远地区数据
  remoteAreas: null,
  // 分类数据
  airportsClassified: null,
  portsClassified: null,
  warehousesData: null,
  // 中英文对照数据
  cityNamesZh: null,
  // 当前选中的 Tab: 'airports' | 'ports' | 'warehouses'
  currentTab: 'airports',
  // 展开状态
  expandedContinents: new Set(),
  expandedRegions: new Set(),
  expandedCountries: new Set(),
  expandedCategories: new Set(),  // 海外仓分类展开状态
  // 当前视图模式：'classified' 分类视图 | 'search' 搜索视图
  viewMode: 'classified'
};

// 加载偏远地区数据
async function loadRemoteAreas() {
  try {
    const response = await fetch('/data/remote-areas.json');
    state.remoteAreas = await response.json();
  } catch (error) {
    console.warn('偏远地区数据加载失败:', error);
  }
}

// 加载中英文对照数据
async function loadCityNamesZh() {
  try {
    const response = await fetch('/data/city-names-zh.json');
    state.cityNamesZh = await response.json();
  } catch (error) {
    console.warn('中英文对照数据加载失败:', error);
  }
}

// 获取城市/机场/港口的中文名称
function getChineseName(node) {
  // 1. 优先使用数据中已有的 nameZh 字段（来自翻译脚本）
  if (node.nameZh) {
    return node.nameZh;
  }
  
  if (!state.cityNamesZh) return null;
  
  const data = state.cityNamesZh;
  
  // 2. 查机场代码
  if (node.type === 'airport' && node.code && data.airports[node.code]) {
    return data.airports[node.code];
  }
  
  // 3. 查港口代码
  if (node.type === 'port' && node.code && data.ports[node.code]) {
    return data.ports[node.code];
  }
  
  // 4. 查城市名
  if (node.city && data.cities[node.city]) {
    return data.cities[node.city];
  }
  if (node.name && data.cities[node.name]) {
    return data.cities[node.name];
  }
  
  return null;
}

// 偏远类型中文翻译
function translateRemoteType(type) {
  const translations = {
    // UPS
    'Extended Area': '偏远',
    'DAS': '偏远',
    'DAS Extended': '偏远',
    'Alaska Remote': '阿拉斯加偏远',
    'Hawaii Remote': '夏威夷偏远',
    'Remote': '偏远',
    // FedEx
    'Alaska': '阿拉斯加偏远',
    'Hawaii': '夏威夷偏远',
    'Intra-Hawaii': '夏威夷岛内',
    // DHL
    'Remote Area': '偏远',
    // USPS
    'Noncontiguous': '非本土',
    'APO/FPO': '军事地址'
  };
  return translations[type] || '偏远';
}

// 判断 ZIP Code 是否为偏远地区（分快递公司：UPS/FedEx/DHL/USPS）
function checkRemoteArea(zipCode) {
  const defaultResult = { 
    ups: { isRemote: false, type: null },
    fedex: { isRemote: false, type: null },
    dhl: { isRemote: false, type: null },
    usps: { isRemote: false, type: null },
    hasAnyRemote: false
  };
  
  if (!state.remoteAreas || !zipCode) {
    return defaultResult;
  }
  
  const zip = zipCode.toString().trim();
  const zip3 = zip.substring(0, 3);
  
  const result = { ...defaultResult };
  
  // 辅助函数：检查ZIP是否匹配前缀列表
  const matchesPrefix = (prefixObj) => {
    if (!prefixObj) return false;
    for (const prefixes of Object.values(prefixObj)) {
      if (prefixes.some(p => zip.startsWith(p))) return true;
    }
    return false;
  };
  
  // 检查 UPS（使用2025官方数据）
  const upsData = state.remoteAreas.ups;
  if (upsData) {
    // 优先检查完整ZIP列表
    if (upsData.all_remote_zips?.includes(zip)) {
      // 判断具体类型
      if (upsData.alaska_remote_zips?.includes(zip)) {
        result.ups = { isRemote: true, type: 'Alaska Remote' };
      } else if (upsData.hawaii_remote_zips?.includes(zip)) {
        result.ups = { isRemote: true, type: 'Hawaii Remote' };
      } else if (upsData.us48_remote_zips?.includes(zip)) {
        result.ups = { isRemote: true, type: 'Remote' };
      } else if (upsData.das_extended_zips?.includes(zip)) {
        result.ups = { isRemote: true, type: 'DAS Extended' };
      } else if (upsData.das_zips?.includes(zip)) {
        result.ups = { isRemote: true, type: 'DAS' };
      } else {
        result.ups = { isRemote: true, type: 'Extended Area' };
      }
    }
  }
  
  // 检查 FedEx（使用2025官方数据）
  const fedexData = state.remoteAreas.fedex;
  if (fedexData) {
    // 优先检查完整ZIP列表
    if (fedexData.all_remote_zips?.includes(zip)) {
      // 判断具体类型
      if (fedexData.alaska_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'Alaska' };
      } else if (fedexData.hawaii_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'Hawaii' };
      } else if (fedexData.intra_hawaii_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'Intra-Hawaii' };
      } else if (fedexData.remote_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'Remote' };
      } else if (fedexData.das_extended_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'DAS Extended' };
      } else if (fedexData.das_zips?.includes(zip)) {
        result.fedex = { isRemote: true, type: 'DAS' };
      } else {
        result.fedex = { isRemote: true, type: 'DAS' };
      }
    }
  }
  
  // 检查 DHL（使用2025官方数据）
  const dhlData = state.remoteAreas.dhl;
  if (dhlData) {
    // 优先检查完整ZIP列表
    if (dhlData.all_remote_zips?.includes(zip)) {
      // 判断具体类型
      if (dhlData.alaska_zips?.includes(zip)) {
        result.dhl = { isRemote: true, type: 'Alaska Remote' };
      } else if (dhlData.hawaii_zips?.includes(zip)) {
        result.dhl = { isRemote: true, type: 'Hawaii Remote' };
      } else {
        result.dhl = { isRemote: true, type: 'Remote Area' };
      }
    }
  }
  
  // 检查 USPS
  const uspsData = state.remoteAreas.usps;
  if (uspsData) {
    if (matchesPrefix(uspsData.zip_prefixes)) {
      result.usps = { isRemote: true, type: 'Noncontiguous' };
    } else if (uspsData.apo_fpo_prefixes?.some(p => zip.startsWith(p))) {
      result.usps = { isRemote: true, type: 'APO/FPO' };
    }
  }
  
  result.hasAnyRemote = result.ups.isRemote || result.fedex.isRemote || result.dhl.isRemote || result.usps.isRemote;
  
  return result;
}

// 从地址中提取 ZIP Code
function extractZipCode(address) {
  // 美国 ZIP Code 格式：5位数字 或 5位-4位
  const match = address.match(/\b(\d{5})(-\d{4})?\b/);
  return match ? match[1] : null;
}

// 判断是否是美国地址
function isUSAddress(address) {
  if (!address) return false;
  const addrLower = address.toLowerCase();
  // 检查是否包含美国相关关键词
  const usKeywords = ['美国', 'usa', 'united states', 'u.s.a', 'u.s.', ', us'];
  return usKeywords.some(keyword => addrLower.includes(keyword));
}

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
  // 将下拉框添加到地址搜索面板
  document.getElementById("addressSearch").appendChild(autocompleteDropdown);
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
  // 判断是哪个输入框
  const isPointB = state.distanceMode && currentInputTarget === 'B';
  const targetInput = isPointB ? addressInputB : addressInput;
  
  // 先更新输入框并隐藏下拉框
  targetInput.value = description;
  autocompleteDropdown.style.display = "none";
  
  // 如果是点B，只获取坐标不显示详情
  if (isPointB) {
    try {
      const response = await fetch(`/api/places-details?place_id=${encodeURIComponent(placeId)}`);
      const data = await response.json();
      
      if (data.status === "OK" && data.result) {
        const place = data.result;
        state.pointB = {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          name: place.formatted_address || place.name
        };
        calculateAndShowDistance();
      }
    } catch (error) {
      console.error("Failed to fetch place details:", error);
    }
    return;
  }
  
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
      
      // 保存点A坐标（用于测距）
      state.pointA = { lat, lng, name };
      
      // 如果测距模式开启且点B已设置，重新计算距离
      if (state.distanceMode && state.pointB) {
        calculateAndShowDistance();
      }
      
      // 在地图上显示位置
      mapAdapter.focusOnCoords(lat, lng, 12);
      
      // 查找附近的机场/港口
      const nearby = findNearby(lat, lng, 5);
      
      // 检查偏远地区（仅美国地址）
      const zipCode = extractZipCode(name);
      const isUS = isUSAddress(name);
      const remoteCheck = isUS ? checkRemoteArea(zipCode) : null;
      
      // 显示结果
      let html = `
        <div class="address-result__title">📍 ${name}</div>
      `;
      
      // 显示偏远地区状态（仅美国地址，分快递公司：UPS/FedEx/DHL/USPS）
      if (zipCode && isUS && remoteCheck) {
        html += `<div class="address-result__remote-list">`;
        
        // UPS
        if (remoteCheck.ups.isRemote) {
          html += `<div class="remote-item remote-item--warning"><span class="remote-carrier">UPS</span><span class="remote-status">⚠️ ${translateRemoteType(remoteCheck.ups.type)}</span></div>`;
        } else {
          html += `<div class="remote-item remote-item--ok"><span class="remote-carrier">UPS</span><span class="remote-status">✅ 非偏远</span></div>`;
        }
        
        // FedEx
        if (remoteCheck.fedex.isRemote) {
          html += `<div class="remote-item remote-item--warning"><span class="remote-carrier">FedEx</span><span class="remote-status">⚠️ ${translateRemoteType(remoteCheck.fedex.type)}</span></div>`;
        } else {
          html += `<div class="remote-item remote-item--ok"><span class="remote-carrier">FedEx</span><span class="remote-status">✅ 非偏远</span></div>`;
        }
        
        // DHL
        if (remoteCheck.dhl.isRemote) {
          html += `<div class="remote-item remote-item--warning"><span class="remote-carrier">DHL</span><span class="remote-status">⚠️ ${translateRemoteType(remoteCheck.dhl.type)}</span></div>`;
        } else {
          html += `<div class="remote-item remote-item--ok"><span class="remote-carrier">DHL</span><span class="remote-status">✅ 非偏远</span></div>`;
        }
        
        // USPS
        if (remoteCheck.usps.isRemote) {
          html += `<div class="remote-item remote-item--warning"><span class="remote-carrier">USPS</span><span class="remote-status">⚠️ ${translateRemoteType(remoteCheck.usps.type)}</span></div>`;
        } else {
          html += `<div class="remote-item remote-item--ok"><span class="remote-carrier">USPS</span><span class="remote-status">✅ 非偏远</span></div>`;
        }
        
        html += `</div>`;
      }
      
      if (nearby.length > 0) {
        html += `
          <div class="address-result__nearby">
            <div class="address-result__nearby-title">📦 附近的机场/港口：</div>
            ${nearby.map((node, index) => {
              // 机场用飞机，港口用轮船
              const icon = node.type === "airport" ? "✈️" : "🚢";
              const typeLabel = node.intl ? "国际" : "国内";
              // 获取中文名称
              const zhName = getChineseName(node);
              // 显示格式：有中文时显示 "中文名 / 英文名"，无中文时只显示英文
              const displayName = zhName 
                ? `<span class="nearby-name-zh">${zhName}</span><span class="nearby-name-divider">/</span><span class="nearby-name-en">${node.name}</span>` 
                : `<span class="nearby-name">${node.name}</span>`;
              return `
                <div class="address-result__nearby-item" data-id="${node.id}" data-lat="${node.lat}" data-lng="${node.lng}" data-name="${node.name}">
                  <span class="nearby-icon">${icon}</span>
                  <span class="nearby-code">${node.code}</span>
                  ${displayName}
                  ${typeLabel ? `<span class="nearby-type">${typeLabel}</span>` : ''}
                  <span class="nearby-distance" id="nearby-dist-${index}">${node.distance.toFixed(0)} km</span>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }
      
      // 异步获取运输距离并更新显示
      if (nearby.length > 0) {
        nearby.forEach(async (node, index) => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${node.lng},${node.lat}?overview=false`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const routeKm = Math.round(data.routes[0].distance / 1000);
              const distEl = document.getElementById(`nearby-dist-${index}`);
              if (distEl) {
                distEl.textContent = `${routeKm} km`;
              }
            }
          } catch (error) {
            // 保持直线距离显示
          }
        });
      }
      
      addressResult.innerHTML = html;
      addressResult.className = "address-result address-result--visible";
      
      // 绑定附近项点击事件 - 显示测距线
      addressResult.querySelectorAll(".address-result__nearby-item").forEach(item => {
        item.addEventListener("click", () => {
          const node = state.allNodes.find(n => n.id === item.dataset.id);
          if (node && state.pointA) {
            // 显示从搜索地址到机场/港口的距离线
            const pointB = {
              lat: node.lat,
              lng: node.lng,
              name: node.name
            };
            mapAdapter.showDistanceLine(state.pointA, pointB);
            
            if (window.innerWidth <= 768) {
              app.classList.remove("app--sidebar-open");
            }
          } else if (node) {
            mapAdapter.focusOn(node);
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
    currentInputTarget = 'A';
    // 隐藏之前的搜索结果，方便显示联想地址
    addressResult.classList.remove("address-result--visible");
    autocompleteDebounce = setTimeout(() => {
      fetchAutocompleteSuggestions(addressInput.value);
    }, 300); // 300ms 防抖，减少请求频率
  });
  
  // 聚焦时如果有内容也显示建议
  addressInput.addEventListener("focus", () => {
    currentInputTarget = 'A';
    if (addressInput.value.trim().length >= 2) {
      fetchAutocompleteSuggestions(addressInput.value);
    }
  });
  
  // 点击外部关闭下拉框
  document.addEventListener("click", (e) => {
    if (!addressInput.contains(e.target) && 
        !addressInputB.contains(e.target) && 
        !autocompleteDropdown.contains(e.target)) {
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
  
  // ========== 两地距离功能 ==========
  
  // 打开测距模式
  toggleDistanceBtn.addEventListener("click", () => {
    state.distanceMode = true;
    toggleDistanceBtn.classList.add("distance-add-btn--hidden");
    addressInputBRow.classList.remove("address-input-row--hidden");
    // 隐藏附近机场/港口信息
    addressResult.classList.remove("address-result--visible");
    addressInputB.focus();
  });
  
  // 关闭测距模式
  function closeDistanceMode() {
    state.distanceMode = false;
    toggleDistanceBtn.classList.remove("distance-add-btn--hidden");
    addressInputBRow.classList.add("address-input-row--hidden");
    addressInputB.value = "";
    state.pointB = null;
    distanceResult.classList.remove("distance-result--visible");
    // 清除地图上的距离线和标记
    mapAdapter.clearDistanceLine && mapAdapter.clearDistanceLine();
    // 恢复显示附近机场/港口信息（如果有内容）
    if (addressResult.innerHTML.trim()) {
      addressResult.classList.add("address-result--visible");
    }
  }
  
  closeDistanceBtn.addEventListener("click", closeDistanceMode);
  
  // 第二个地址输入框事件
  addressInputB.addEventListener("input", () => {
    clearTimeout(autocompleteDebounce);
    currentInputTarget = 'B';
    autocompleteDebounce = setTimeout(() => {
      fetchAutocompleteSuggestions(addressInputB.value);
    }, 300);
  });
  
  addressInputB.addEventListener("focus", () => {
    currentInputTarget = 'B';
    if (addressInputB.value.trim().length >= 2) {
      fetchAutocompleteSuggestions(addressInputB.value);
    }
  });
  
  // B输入框键盘导航
  addressInputB.addEventListener("keydown", (e) => {
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
}

// 当前输入的目标（A 或 B）
let currentInputTarget = 'A';

// 计算并显示两地距离
async function calculateAndShowDistance() {
  if (!state.pointA || !state.pointB) return;
  
  const straightKm = getDistance(
    state.pointA.lat, state.pointA.lng,
    state.pointB.lat, state.pointB.lng
  );
  
  // 先显示直线距离
  distanceResult.innerHTML = `
    <div class="distance-row">
      <span class="distance-result__icon">✈️</span>
      <span class="distance-result__text">直线</span>
      <span class="distance-result__value">${straightKm.toFixed(0)} km</span>
    </div>
    <div class="distance-row distance-row--loading">
      <span class="distance-result__icon">🚗</span>
      <span class="distance-result__text">公路</span>
      <span class="distance-result__value">计算中...</span>
    </div>
  `;
  distanceResult.classList.add("distance-result--visible");
  
  // 在地图上显示路线
  mapAdapter.showDistanceLine && await mapAdapter.showDistanceLine(state.pointA, state.pointB);
  
  // 尝试获取公路距离
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${state.pointA.lng},${state.pointA.lat};${state.pointB.lng},${state.pointB.lat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const routeKm = (data.routes[0].distance / 1000).toFixed(0);
      const routeHours = Math.floor(data.routes[0].duration / 3600);
      const routeMins = Math.floor((data.routes[0].duration % 3600) / 60);
      const timeStr = routeHours > 0 ? `${routeHours}h ${routeMins}m` : `${routeMins}m`;
      
      distanceResult.innerHTML = `
        <div class="distance-row">
          <span class="distance-result__icon">✈️</span>
          <span class="distance-result__text">直线</span>
          <span class="distance-result__value">${straightKm.toFixed(0)} km</span>
        </div>
        <div class="distance-row">
          <span class="distance-result__icon">🚗</span>
          <span class="distance-result__text">公路</span>
          <span class="distance-result__value">${routeKm} km (${timeStr})</span>
        </div>
      `;
    } else {
      // 无法获取公路距离（可能是跨洋等）
      distanceResult.innerHTML = `
        <div class="distance-row">
          <span class="distance-result__icon">✈️</span>
          <span class="distance-result__text">直线</span>
          <span class="distance-result__value">${straightKm.toFixed(0)} km</span>
        </div>
        <div class="distance-row distance-row--unavailable">
          <span class="distance-result__icon">🚗</span>
          <span class="distance-result__text">公路</span>
          <span class="distance-result__value">无陆路</span>
        </div>
      `;
    }
  } catch (error) {
    console.warn('获取公路距离失败:', error);
  }
}

// ========== 机场/港口搜索 ==========

function applyFilters() {
  const query = searchInput.value.trim();

  // 无搜索词时，显示当前Tab的分类视图
  if (!query) {
    state.filteredNodes = [];
    renderResults();
    mapAdapter.setMarkers([]);
    return;
  }

  // 智能搜索：搜索所有数据源，自动切换到有结果的Tab
  const warehouseResults = searchWarehouses(query);
  const airportResults = searchInNodes(query, 'airport');
  const portResults = searchInNodes(query, 'port');

  // 根据搜索结果自动切换Tab（优先级：精确匹配 > 结果数量）
  let targetTab = state.currentTab;
  let results = [];

  // 检查海外仓是否有精确匹配
  if (warehouseResults.length > 0 && warehouseResults.some(w => 
    w.code.toUpperCase() === query.toUpperCase())) {
    targetTab = 'warehouses';
    results = warehouseResults;
  }
  // 检查机场是否有精确匹配
  else if (airportResults.length > 0 && airportResults.some(a => 
    a.code.toUpperCase() === query.toUpperCase())) {
    targetTab = 'airports';
    results = airportResults;
  }
  // 检查港口是否有精确匹配
  else if (portResults.length > 0 && portResults.some(p => 
    p.code.toUpperCase() === query.toUpperCase())) {
    targetTab = 'ports';
    results = portResults;
  }
  // 无精确匹配，选择结果最多的Tab
  else if (warehouseResults.length >= airportResults.length && warehouseResults.length >= portResults.length && warehouseResults.length > 0) {
    targetTab = 'warehouses';
    results = warehouseResults;
  } else if (portResults.length >= airportResults.length && portResults.length > 0) {
    targetTab = 'ports';
    results = portResults;
  } else if (airportResults.length > 0) {
    targetTab = 'airports';
    results = airportResults;
  }

  // 如果需要切换Tab，更新UI（不重新触发applyFilters）
  if (targetTab !== state.currentTab) {
    state.currentTab = targetTab;
    tabAirports.classList.toggle('hub-tab--active', targetTab === 'airports');
    tabPorts.classList.toggle('hub-tab--active', targetTab === 'ports');
    tabWarehouses.classList.toggle('hub-tab--active', targetTab === 'warehouses');
  }

  // 渲染结果
  state.filteredNodes = results;
  
  if (targetTab === 'warehouses') {
    renderWarehouseSearchResults(results);
    mapAdapter.setMarkers([]);
    // 如果只有一个结果，自动跳转到地图
    if (results.length === 1) {
      const w = results[0];
      mapAdapter.focusOnCoords(w.lat, w.lng, 14, 'warehouse', w.categoryName, {
        code: w.code,
        address: w.address || ''
      });
    }
  } else {
    renderSearchResults();
    // 如果只有一个结果，自动跳转到地图
    if (results.length === 1) {
      mapAdapter.setMarkers([]);
      mapAdapter.focusOnCoords(results[0].lat, results[0].lng, 12, results[0].type);
    } else {
      // 多个结果时不显示标记聚合（保持地图清洁）
      mapAdapter.setMarkers([]);
    }
  }
}

// 获取中文城市名对应的英文城市名列表
function getEnglishCityNames(chineseQuery) {
  if (!state.cityNamesZh || !state.cityNamesZh.cities) return [];
  
  const cities = state.cityNamesZh.cities;
  const q = chineseQuery.toLowerCase();
  const matches = [];
  
  // 遍历城市映射，找出中文名包含查询词的英文城市名
  for (const [englishName, chineseName] of Object.entries(cities)) {
    if (chineseName && chineseName.toLowerCase().includes(q)) {
      matches.push(englishName.toLowerCase());
    }
  }
  
  return matches;
}

// 在机场或港口中搜索（同时搜索分类数据）
// 支持：代码、名称、城市、国家（中英文）
function searchInNodes(query, type) {
  const q = query.toLowerCase();
  const qUpper = query.toUpperCase();
  
  // 获取中文城市名对应的英文城市名
  const englishCityNames = getEnglishCityNames(query);
  let exactMatches = [];  // 精确匹配（代码完全相同）
  let prefixMatches = []; // 前缀匹配（代码以搜索词开头）
  let cityMatches = [];   // 城市匹配
  let countryMatches = []; // 国家匹配
  let otherMatches = [];  // 其他匹配
  
  if (type === 'airport' && state.airportsClassified) {
    // 搜索分类数据中的机场
    for (const continent of Object.values(state.airportsClassified.continents)) {
      for (const region of Object.values(continent.regions)) {
        for (const country of Object.values(region.countries)) {
          // 检查是否匹配国家名（中文或英文）
          const countryNameZh = (country.name || '').toLowerCase();
          const countryNameEn = (country.nameEn || '').toLowerCase();
          const countryCode = (country.code || '').toUpperCase();
          const isCountryMatch = countryNameZh.includes(q) || countryNameEn.includes(q) || countryCode === qUpper;
          
          for (const airport of country.airports) {
            const code = (airport.code || '').toUpperCase();
            const icao = (airport.icao || '').toUpperCase();
            const iata = (airport.iata || '').toUpperCase();
            const name = (airport.name || '').toLowerCase();
            const nameZh = (airport.nameZh || '').toLowerCase();
            const city = (airport.city || '').toLowerCase();
            
            const item = {
              ...airport,
              type: 'airport',
              country: country.name
            };
            
            // 检查英文城市名是否匹配（支持中文搜索）
            const cityMatchesEnglish = englishCityNames.some(en => city === en || city.startsWith(en) || city.includes(en));
            
            // 精确匹配代码
            if (code === qUpper || icao === qUpper || iata === qUpper) {
              exactMatches.push(item);
            }
            // 前缀匹配代码
            else if (code.startsWith(qUpper) || icao.startsWith(qUpper) || iata.startsWith(qUpper)) {
              prefixMatches.push(item);
            }
            // 城市匹配（精确优先，支持中英文）
            else if (city === q || city.startsWith(q) || cityMatchesEnglish) {
              cityMatches.push(item);
            }
            // 国家匹配
            else if (isCountryMatch) {
              countryMatches.push(item);
            }
            // 其他匹配（名称包含搜索词）
            else if (name.includes(q) || nameZh.includes(q) || city.includes(q)) {
              otherMatches.push(item);
            }
          }
        }
      }
    }
  } else if (type === 'port' && state.portsClassified) {
    // 搜索分类数据中的港口
    for (const continent of Object.values(state.portsClassified.continents)) {
      for (const region of Object.values(continent.regions)) {
        for (const country of Object.values(region.countries)) {
          // 检查是否匹配国家名
          const countryNameZh = (country.name || '').toLowerCase();
          const countryNameEn = (country.nameEn || '').toLowerCase();
          const countryCode = (country.code || '').toUpperCase();
          const isCountryMatch = countryNameZh.includes(q) || countryNameEn.includes(q) || countryCode === qUpper;
          
          for (const port of country.ports) {
            const code = (port.code || '').toUpperCase();
            const name = (port.name || '').toLowerCase();
            const nameZh = (port.nameZh || '').toLowerCase();
            const city = (port.city || '').toLowerCase();
            
            const item = {
              ...port,
              type: 'port',
              country: country.name
            };
            
            // 检查英文城市名是否匹配（支持中文搜索）
            const cityMatchesEnglish = englishCityNames.some(en => city === en || city.startsWith(en) || city.includes(en));
            
            // 精确匹配代码
            if (code === qUpper) {
              exactMatches.push(item);
            }
            // 前缀匹配代码
            else if (code.startsWith(qUpper)) {
              prefixMatches.push(item);
            }
            // 城市匹配（支持中英文）
            else if (city === q || city.startsWith(q) || cityMatchesEnglish) {
              cityMatches.push(item);
            }
            // 国家匹配
            else if (isCountryMatch) {
              countryMatches.push(item);
            }
            // 其他匹配
            else if (name.includes(q) || nameZh.includes(q) || city.includes(q)) {
              otherMatches.push(item);
            }
          }
        }
      }
    }
  }
  
  // 返回排序后的结果：精确匹配 > 前缀匹配 > 城市匹配 > 国家匹配 > 其他匹配
  // 国家匹配时限制返回前100个（避免返回太多）
  const limitedCountryMatches = countryMatches.slice(0, 100);
  return [...exactMatches, ...prefixMatches, ...cityMatches, ...limitedCountryMatches, ...otherMatches];
}

// 搜索海外仓数据
function searchWarehouses(query) {
  const q = query.toLowerCase();
  const qUpper = query.toUpperCase();
  let exactMatches = [];  // 精确匹配
  let prefixMatches = []; // 前缀匹配
  let cityMatches = [];   // 城市匹配
  let otherMatches = [];  // 其他匹配
  
  if (!state.warehousesData) return [];
  
  // 获取中文城市名对应的英文城市名
  const englishCityNames = getEnglishCityNames(query);
  
  for (const [catKey, category] of Object.entries(state.warehousesData.categories)) {
    for (const [countryCode, country] of Object.entries(category.countries)) {
      for (const warehouse of country.warehouses) {
        const code = (warehouse.code || '').toUpperCase();
        const name = (warehouse.name || '').toLowerCase();
        const city = (warehouse.city || '').toLowerCase();
        const company = (warehouse.company || '').toLowerCase();
        
        const item = {
          ...warehouse,
          categoryName: category.name,
          countryName: country.name
        };
        
        // 检查英文城市名是否匹配（支持中文搜索）
        const cityMatchesEnglish = englishCityNames.some(en => city === en || city.startsWith(en) || city.includes(en));
        
        // 精确匹配代码
        if (code === qUpper) {
          exactMatches.push(item);
        }
        // 前缀匹配代码
        else if (code.startsWith(qUpper)) {
          prefixMatches.push(item);
        }
        // 城市匹配（支持中英文）
        else if (city === q || city.startsWith(q) || cityMatchesEnglish) {
          cityMatches.push(item);
        }
        // 其他匹配
        else if (name.includes(q) || city.includes(q) || company.includes(q)) {
          otherMatches.push(item);
        }
      }
    }
  }
  
  return [...exactMatches, ...prefixMatches, ...cityMatches, ...otherMatches];
}

// 渲染海外仓搜索结果 - 与列表视图格式保持一致
function renderWarehouseSearchResults(results) {
  resultsList.innerHTML = results.length === 0 
    ? '<li class="result-item"><div class="result-item__meta">未找到匹配的海外仓</div></li>'
    : results.map(w => {
        // 根据分类名称设置分类属性
        let category = 'freight';
        if (w.categoryName && w.categoryName.includes('亚马逊')) {
          category = 'amazon';
        } else if (w.categoryName && w.categoryName.includes('沃尔玛')) {
          category = 'walmart';
        }
        
        // 处理地址
        let address = w.address || '';
        address = address
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ', ')
          .replace(/,\s*,/g, ',')
          .replace(/[,\s]*-?\s*United\s*[Ss]tates?\s*$/i, ', US')
          .replace(/[,\s]*-?\s*US\s*$/i, ', US')
          .replace(/,\s*$/g, '')
          .replace(/^\s*,\s*/g, '')
          .trim();
        
        // 获取州名中文
        const stateCode = w.state || '';
        const stateZh = state.usStatesZh?.states?.[stateCode] || '';
        const stateLabel = stateCode ? `<span class="warehouse-state">${stateCode}${stateZh ? ' ' + stateZh : ''}</span>` : '';
        
        // 类型标签
        const typeLabel = w.type ? `<span class="warehouse-type-tag">${w.type}</span>` : '';
        
        const addressAttr = address ? `data-address="${address.replace(/"/g, '&quot;')}"` : '';
        const addressLine = address ? `<div class="result-item__address">${address}</div>` : '';
        
        return `
          <li class="result-item result-item--search result-item--warehouse" data-lat="${w.lat}" data-lng="${w.lng}" data-type="warehouse" data-category="${category}" data-code="${w.code}" ${addressAttr}>
            <div class="result-item__title">
              <span class="warehouse-code-group">${w.code} ${typeLabel}</span>
              ${stateLabel}
            </div>
            ${addressLine}
          </li>
        `;
      }).join('');
}

function renderResults() {
  const query = searchInput.value.trim();
  
  // 如果有搜索词，显示搜索结果
  if (query) {
    state.viewMode = 'search';
    renderSearchResults();
  } else {
    // 无搜索词，显示分类视图
    state.viewMode = 'classified';
    if (state.currentTab === 'warehouses') {
      renderWarehousesView();
    } else {
      renderClassifiedView();
    }
  }
}

// 渲染搜索结果（平铺列表）- 与列表视图格式保持一致
function renderSearchResults() {
  const displayNodes = state.filteredNodes.slice(0, 200);
  
  if (displayNodes.length === 0) {
    resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">未找到匹配结果</div></li>';
    return;
  }
  
  resultsList.innerHTML = displayNodes
    .map((node) => {
      const code = node.code || "";
      const type = node.type || "airport";
      const isAirport = type === "airport";
      const isIntl = node.intl === 1;
      
      // 获取中文名称
      const zhName = getChineseName(node);
      const nameZh = zhName || '';
      
      // 中英文名称格式 - 与列表视图一致
      const namesHtml = nameZh 
        ? `<span class="airport-name-zh">${nameZh}</span><span class="airport-name-divider">/</span><span class="airport-name-en">${node.name}</span>`
        : `<span class="airport-name-en" style="color:#0f172a;font-weight:500;">${node.name}</span>`;
      
      // 类型标签 - 与列表视图一致
      let typeTag;
      if (isAirport) {
        typeTag = isIntl 
          ? '<span class="airport-type-tag airport-type-tag--intl">国际机场</span>'
          : '<span class="airport-type-tag airport-type-tag--domestic">国内机场</span>';
      } else {
        typeTag = isIntl 
          ? '<span class="airport-type-tag airport-type-tag--intl port-type-tag">国际港口</span>'
          : '<span class="airport-type-tag airport-type-tag--domestic port-type-tag">国内港口</span>';
      }
      
      const codeClass = isAirport ? 'airport-code' : 'airport-code port-code';
      const itemClass = isAirport 
        ? 'result-item result-item--search result-item--airport result-item--airport-new'
        : 'result-item result-item--search result-item--airport result-item--airport-new result-item--port-new';
      
      return `
        <li class="${itemClass}" data-lat="${node.lat}" data-lng="${node.lng}" data-type="${type}" data-code="${code}" data-name="${node.name}" data-name-zh="${nameZh}" data-intl="${node.intl ? 1 : 0}">
          <div class="airport-row1">
            <span class="${codeClass}">${code}</span>
            <span class="airport-names">${namesHtml}</span>
          </div>
          <div class="airport-row2">
            <span class="airport-city">${node.city}</span>
            ${typeTag}
          </div>
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

// 渲染分类视图（大洲 → 区域 → 国家）
function renderClassifiedView() {
  const isAirports = state.currentTab === 'airports';
  const classifiedData = isAirports ? state.airportsClassified : state.portsClassified;
  
  if (!classifiedData) {
    resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">加载分类数据中...</div></li>';
    return;
  }
  
  let html = '';
  
  // 大洲顺序
  const continentOrder = ['AS', 'EU', 'NA', 'SA', 'AF', 'OC'];
  
  for (const contCode of continentOrder) {
    const continent = classifiedData.continents[contCode];
    if (!continent) continue;
    
    const totalCount = isAirports ? continent.totalAirports : continent.totalPorts;
    if (totalCount === 0) continue;
    
    const isContExpanded = state.expandedContinents.has(contCode);
    const contIcon = isContExpanded ? '▼' : '▶';
    
    html += `
      <li class="tree-item tree-item--continent" data-continent="${contCode}">
        <div class="tree-item__header tree-item__header--continent">
          <span class="tree-icon">${contIcon}</span>
          <span class="tree-name">${continent.name}</span>
          <span class="tree-count">${totalCount}</span>
        </div>
    `;
    
    if (isContExpanded) {
      html += '<ul class="tree-children">';
      
      for (const [regCode, region] of Object.entries(continent.regions)) {
        const regTotal = isAirports ? region.totalAirports : region.totalPorts;
        if (regTotal === 0) continue;
        
        const regKey = `${contCode}-${regCode}`;
        const isRegExpanded = state.expandedRegions.has(regKey);
        const regIcon = isRegExpanded ? '▼' : '▶';
        
        html += `
          <li class="tree-item tree-item--region" data-continent="${contCode}" data-region="${regCode}">
            <div class="tree-item__header tree-item__header--region">
              <span class="tree-icon">${regIcon}</span>
              <span class="tree-name">${region.name}</span>
              <span class="tree-count">${regTotal}</span>
            </div>
        `;
        
        if (isRegExpanded) {
          html += '<ul class="tree-children">';
          
          // 按数量排序国家，东亚地区特殊排序（四字名称的国家排在后面，朝鲜除外）
          const sortedCountries = Object.entries(region.countries)
            .sort((a, b) => {
              const aTotal = isAirports ? a[1].totalAirports : a[1].totalPorts;
              const bTotal = isAirports ? b[1].totalAirports : b[1].totalPorts;
              
              // 东亚地区特殊排序：朝鲜排在中国台湾前面，四字名称排最后
              if (regCode === 'EA') {
                // 特殊排序优先级（数字越大越靠后）
                const specialOrder = {
                  'KP': 10,  // 朝鲜 - 排在四字名称前
                  'TW': 20,  // 中国台湾
                  'HK': 30,  // 中国香港
                  'MO': 40,  // 中国澳门
                  'XP': 50   // 南海诸岛 - 排最后
                };
                const aOrder = specialOrder[a[0]] || 0;
                const bOrder = specialOrder[b[0]] || 0;
                
                // 如果两个都有特殊排序，按特殊顺序
                if (aOrder > 0 && bOrder > 0) {
                  return aOrder - bOrder;
                }
                // 如果只有一个有特殊排序，没有特殊排序的排前面
                if (aOrder > 0) return 1;
                if (bOrder > 0) return -1;
              }
              
              // 默认按数量降序排序
              return bTotal - aTotal;
            });
          
          for (const [countryCode, country] of sortedCountries) {
            const countryTotal = isAirports ? country.totalAirports : country.totalPorts;
            if (countryTotal === 0) continue;
            
            const countryKey = `${contCode}-${regCode}-${countryCode}`;
            const isCountryExpanded = state.expandedCountries.has(countryKey);
            const countryIcon = isCountryExpanded ? '▼' : '▶';
            
            // 机场显示国际机场数量
            const countLabel = isAirports 
              ? `${countryTotal} (${country.intlAirports || 0})`
              : `${countryTotal}`;
            
            html += `
              <li class="tree-item tree-item--country" data-continent="${contCode}" data-region="${regCode}" data-country="${countryCode}">
                <div class="tree-item__header tree-item__header--country">
                  <span class="tree-icon">${countryIcon}</span>
                  <span class="tree-name">${country.name}</span>
                  <span class="tree-count">${countLabel}</span>
                </div>
            `;
            
            if (isCountryExpanded) {
              html += '<ul class="tree-children tree-children--airports">';
              
              if (isAirports) {
                for (const airport of country.airports) {
                  const nameZh = airport.nameZh || '';
                  const isIntl = airport.intl === 1;
                  const typeTag = isIntl 
                    ? '<span class="airport-type-tag airport-type-tag--intl">国际机场</span>'
                    : '<span class="airport-type-tag airport-type-tag--domestic">国内机场</span>';
                  // 显示中英文名称
                  const namesHtml = nameZh 
                    ? `<span class="airport-name-zh">${nameZh}</span><span class="airport-name-divider">/</span><span class="airport-name-en">${airport.name}</span>`
                    : `<span class="airport-name-en" style="color:#0f172a;font-weight:500;">${airport.name}</span>`;
                  html += `
                    <li class="result-item result-item--airport result-item--airport-new" data-lat="${airport.lat}" data-lng="${airport.lng}" data-name="${airport.name}" data-name-zh="${nameZh}" data-code="${airport.code}" data-intl="${airport.intl ? 1 : 0}" data-type="airport">
                      <div class="airport-row1">
                        <span class="airport-code">${airport.code}</span>
                        <span class="airport-names">${namesHtml}</span>
                      </div>
                      <div class="airport-row2">
                        <span class="airport-city">${airport.city}</span>
                        ${typeTag}
                      </div>
                    </li>
                  `;
                }
              } else {
                for (const port of country.ports) {
                  const nameZh = port.nameZh || '';
                  const isIntl = port.intl || false;
                  // 显示中英文名称
                  const namesHtml = nameZh 
                    ? `<span class="airport-name-zh">${nameZh}</span><span class="airport-name-divider">/</span><span class="airport-name-en">${port.name}</span>`
                    : `<span class="airport-name-en" style="color:#0f172a;font-weight:500;">${port.name}</span>`;
                  // 港口类型标签
                  const typeTag = isIntl 
                    ? `<span class="airport-type-tag airport-type-tag--intl port-type-tag">国际港口</span>`
                    : `<span class="airport-type-tag airport-type-tag--domestic port-type-tag">国内港口</span>`;
                  html += `
                    <li class="result-item result-item--airport result-item--airport-new result-item--port-new" data-lat="${port.lat}" data-lng="${port.lng}" data-name="${port.name}" data-name-zh="${nameZh}" data-code="${port.code}" data-intl="${isIntl ? 1 : 0}" data-type="port">
                      <div class="airport-row1">
                        <span class="airport-code port-code">${port.code}</span>
                        <span class="airport-names">${namesHtml}</span>
                      </div>
                      <div class="airport-row2">
                        <span class="airport-city">${port.city}</span>
                        ${typeTag}
                      </div>
                    </li>
                  `;
                }
              }
              
              html += '</ul>';
            }
            
            html += '</li>';
          }
          
          html += '</ul>';
        }
        
        html += '</li>';
      }
      
      html += '</ul>';
    }
    
    html += '</li>';
  }
  
  resultsList.innerHTML = html;
  
  // 绑定展开/折叠事件
  bindTreeEvents();
}

// 渲染海外仓视图
function renderWarehousesView() {
  if (!state.warehousesData) {
    resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">加载海外仓数据中...</div></li>';
    return;
  }
  
  let html = '';
  const categories = state.warehousesData.categories;
  
  // 分类顺序：亚马逊、沃尔玛、货代公司
  const categoryOrder = ['amazon', 'walmart', 'freight'];
  
  for (const catKey of categoryOrder) {
    const category = categories[catKey];
    if (!category) continue;
    
    const isCatExpanded = state.expandedCategories.has(catKey);
    const catIcon = isCatExpanded ? '▼' : '▶';
    
    html += `
      <li class="tree-item tree-item--continent" data-category="${catKey}">
        <div class="tree-item__header tree-item__header--continent">
          <span class="tree-icon">${catIcon}</span>
          <span class="tree-name">${category.name}</span>
          <span class="tree-count">${category.totalWarehouses}</span>
        </div>
    `;
    
    if (isCatExpanded) {
      html += '<ul class="tree-children">';
      
      // 按仓库数量排序国家
      const sortedCountries = Object.entries(category.countries)
        .sort((a, b) => b[1].totalWarehouses - a[1].totalWarehouses);
      
      for (const [countryCode, country] of sortedCountries) {
        const countryKey = `${catKey}-${countryCode}`;
        const isCountryExpanded = state.expandedCountries.has(countryKey);
        const countryIcon = isCountryExpanded ? '▼' : '▶';
        
        html += `
          <li class="tree-item tree-item--region" data-category="${catKey}" data-country="${countryCode}">
            <div class="tree-item__header tree-item__header--region">
              <span class="tree-icon">${countryIcon}</span>
              <span class="tree-name">${country.name}</span>
              <span class="tree-count">${country.totalWarehouses}</span>
            </div>
        `;
        
        if (isCountryExpanded) {
          html += '<ul class="tree-children tree-children--airports">';
          
          for (const warehouse of country.warehouses) {
            const companyLabel = warehouse.company ? ` · ${warehouse.company}` : '';
            const typeLabel = warehouse.type ? `<span class="warehouse-type-tag">${warehouse.type}</span>` : '';
            
            // 获取州名中文
            const stateCode = warehouse.state || '';
            const stateZh = state.usStatesZh?.states?.[stateCode] || '';
            const stateLabel = stateCode ? `<span class="warehouse-state">${stateCode}${stateZh ? ' ' + stateZh : ''}</span>` : '';
            
            // 处理地址：清理多余空格，替换 United States 为 US
            let address = warehouse.address || '';
            address = address
              .replace(/\s+/g, ' ')                          // 多个空格变单个
              .replace(/\s*,\s*/g, ', ')                     // 逗号前后空格统一
              .replace(/,\s*,/g, ',')                        // 连续逗号
              .replace(/[,\s]*-?\s*United\s*[Ss]tates?\s*$/i, ', US')  // United States → US
              .replace(/[,\s]*-?\s*US\s*$/i, ', US')         // 统一 US 格式
              .replace(/,\s*$/g, '')                         // 去除末尾逗号
              .replace(/^\s*,\s*/g, '')                      // 去除开头逗号
              .trim();
            const addressLine = address ? `<div class="result-item__address">${address}</div>` : '';
            
            html += `
              <li class="result-item result-item--warehouse" data-warehouse="${warehouse.code}" data-lat="${warehouse.lat}" data-lng="${warehouse.lng}" data-category="${catKey}" data-address="${address}">
                <div class="result-item__title">
                  <span class="warehouse-code-group">${warehouse.code}${companyLabel} ${typeLabel}</span>
                  ${stateLabel}
                </div>
                ${addressLine}
              </li>
            `;
          }
          
          html += '</ul>';
        }
        
        html += '</li>';
      }
      
      html += '</ul>';
    }
    
    html += '</li>';
  }
  
  resultsList.innerHTML = html;
  
  // 绑定海外仓展开/折叠事件
  bindWarehouseTreeEvents();
}

// 绑定海外仓树形结构的展开/折叠事件
function bindWarehouseTreeEvents() {
  // 分类点击
  document.querySelectorAll('.tree-item--continent[data-category] > .tree-item__header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const catKey = el.parentElement.dataset.category;
      if (state.expandedCategories.has(catKey)) {
        state.expandedCategories.delete(catKey);
      } else {
        state.expandedCategories.add(catKey);
      }
      renderWarehousesView();
    });
  });
  
  // 国家点击
  document.querySelectorAll('.tree-item--region[data-category] > .tree-item__header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const catKey = el.parentElement.dataset.category;
      const countryCode = el.parentElement.dataset.country;
      const key = `${catKey}-${countryCode}`;
      if (state.expandedCountries.has(key)) {
        state.expandedCountries.delete(key);
      } else {
        state.expandedCountries.add(key);
      }
      renderWarehousesView();
    });
  });
  
  // 仓库项点击 - 在地图上显示位置（带分类图标和详细地址）
  document.querySelectorAll('.result-item[data-warehouse]').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      const category = el.dataset.category;
      const code = el.dataset.warehouse;
      const address = el.dataset.address || '';
      if (!isNaN(lat) && !isNaN(lng)) {
        // 传递仓库信息用于弹窗显示
        mapAdapter.focusOnCoords(lat, lng, 14, 'warehouse', category, {
          code: code,
          address: address
        });
        if (window.innerWidth <= 768) {
          app.classList.remove("app--sidebar-open");
        }
      }
    });
  });
}

// 绑定树形结构的展开/折叠事件
function bindTreeEvents() {
  // 大洲点击
  document.querySelectorAll('.tree-item--continent > .tree-item__header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const contCode = el.parentElement.dataset.continent;
      if (state.expandedContinents.has(contCode)) {
        state.expandedContinents.delete(contCode);
      } else {
        state.expandedContinents.add(contCode);
      }
      renderClassifiedView();
    });
  });
  
  // 区域点击
  document.querySelectorAll('.tree-item--region > .tree-item__header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const contCode = el.parentElement.dataset.continent;
      const regCode = el.parentElement.dataset.region;
      const key = `${contCode}-${regCode}`;
      if (state.expandedRegions.has(key)) {
        state.expandedRegions.delete(key);
      } else {
        state.expandedRegions.add(key);
      }
      renderClassifiedView();
    });
  });
  
  // 国家点击
  document.querySelectorAll('.tree-item--country > .tree-item__header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const contCode = el.parentElement.dataset.continent;
      const regCode = el.parentElement.dataset.region;
      const countryCode = el.parentElement.dataset.country;
      const key = `${contCode}-${regCode}-${countryCode}`;
      if (state.expandedCountries.has(key)) {
        state.expandedCountries.delete(key);
      } else {
        state.expandedCountries.add(key);
      }
      renderClassifiedView();
    });
  });
  
  // 机场/港口项点击 - 跳转到地图（使用分类数据中的坐标和类型图标）
  document.querySelectorAll('.result-item--airport[data-lat][data-type]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      const type = el.dataset.type;
      if (!isNaN(lat) && !isNaN(lng)) {
        // 构建节点信息用于 popup 显示
        const nodeInfo = {
          code: el.dataset.code || '',
          name: el.dataset.name || '',
          nameZh: el.dataset.nameZh || '',
          intl: el.dataset.intl === '1'
        };
        mapAdapter.focusOnCoords(lat, lng, 12, type, null, nodeInfo);
        // 移动端：点击后关闭侧边栏
        if (window.innerWidth <= 768) {
          app.classList.remove("app--sidebar-open");
        }
      }
    });
  });
}

const resultsSection = document.querySelector(".results");

// 切换 Tab 的通用函数
function switchHubTab(tabName) {
  state.currentTab = tabName;
  
  // 清除展开状态
  state.expandedContinents.clear();
  state.expandedRegions.clear();
  state.expandedCountries.clear();
  
  // 更新 Tab 样式
  tabAirports.classList.toggle('hub-tab--active', tabName === 'airports');
  tabPorts.classList.toggle('hub-tab--active', tabName === 'ports');
  tabWarehouses.classList.toggle('hub-tab--active', tabName === 'warehouses');
  
  // 重新渲染
  applyFilters();
}

// 更新 Tab 上的数量显示
function updateTabCounts() {
  if (state.airportsClassified) {
    airportsCountEl.textContent = state.airportsClassified.totalAirports || 0;
  }
  if (state.portsClassified) {
    portsCountEl.textContent = state.portsClassified.totalPorts || 0;
  }
  if (state.warehousesData) {
    let total = 0;
    // 计算实际仓库数量
    for (const cat of Object.values(state.warehousesData.categories)) {
      if (cat.countries) {
        for (const country of Object.values(cat.countries)) {
          total += country.warehouses ? country.warehouses.length : 0;
        }
      }
    }
    warehousesCountEl.textContent = total;
  }
}

// ========== 搜索联想功能 ==========

function showSearchSuggestions() {
  const query = searchInput.value.trim();
  
  if (query.length < 1) {
    hideSuggestions();
    applyFilters();
    return;
  }
  
  // 获取所有类型的搜索结果（获取更多用于统计）
  const airportResults = searchInNodes(query, 'airport');
  const portResults = searchInNodes(query, 'port');
  const warehouseResults = searchWarehouses(query);
  
  // 统计各类型数量
  const airportCount = airportResults.length;
  const portCount = portResults.length;
  const warehouseCount = warehouseResults.length;
  
  if (airportCount + portCount + warehouseCount === 0) {
    hideSuggestions();
    applyFilters();
    return;
  }
  
  // 构建联想列表HTML
  let html = '';
  
  // 分类快捷入口（显示各类型数量）
  html += '<div class="suggestion-categories">';
  if (airportCount > 0) {
    html += `<div class="suggestion-category" data-tab="airports">✈️ 机场 <span class="suggestion-category__count">${airportCount}</span></div>`;
  }
  if (portCount > 0) {
    html += `<div class="suggestion-category" data-tab="ports">🚢 港口 <span class="suggestion-category__count">${portCount}</span></div>`;
  }
  if (warehouseCount > 0) {
    html += `<div class="suggestion-category" data-tab="warehouses">📦 海外仓 <span class="suggestion-category__count">${warehouseCount}</span></div>`;
  }
  html += '</div>';
  
  // 合并结果并限制显示数量
  const allResults = [
    ...airportResults.slice(0, 3).map(r => ({ ...r, _type: 'airport' })),
    ...portResults.slice(0, 3).map(r => ({ ...r, _type: 'port' })),
    ...warehouseResults.slice(0, 3).map(r => ({ ...r, _type: 'warehouse' }))
  ];
  
  // 按相关性排序（精确匹配优先）
  const qUpper = query.toUpperCase();
  allResults.sort((a, b) => {
    const aExact = (a.code || '').toUpperCase() === qUpper ? 0 : 1;
    const bExact = (b.code || '').toUpperCase() === qUpper ? 0 : 1;
    return aExact - bExact;
  });
  
  // 渲染联想列表 - 与列表视图格式保持一致
  html += allResults.map((item, index) => {
    const code = item.code || '';
    const highlightedCode = highlightMatch(code, query);
    
    let categoryAttr = '';
    let itemHtml = '';
    
    if (item._type === 'airport' || item._type === 'port') {
      // 机场/港口格式 - 与列表视图一致
      const nameZh = item.nameZh || '';
      const isIntl = item.intl === 1;
      const isAirport = item._type === 'airport';
      
      // 中英文名称
      const namesHtml = nameZh 
        ? `<span class="airport-name-zh">${nameZh}</span><span class="airport-name-divider">/</span><span class="airport-name-en">${item.name}</span>`
        : `<span class="airport-name-en">${item.name}</span>`;
      
      // 类型标签
      let typeTag;
      if (isAirport) {
        typeTag = isIntl 
          ? '<span class="airport-type-tag airport-type-tag--intl">国际机场</span>'
          : '<span class="airport-type-tag airport-type-tag--domestic">国内机场</span>';
      } else {
        typeTag = isIntl 
          ? '<span class="airport-type-tag airport-type-tag--intl port-type-tag">国际港口</span>'
          : '<span class="airport-type-tag airport-type-tag--domestic port-type-tag">国内港口</span>';
      }
      
      const codeClass = isAirport ? 'airport-code' : 'airport-code port-code';
      
      itemHtml = `
        <div class="suggestion-item suggestion-item--airport" data-index="${index}" data-lat="${item.lat}" data-lng="${item.lng}" data-type="${item._type}" data-code="${code}" data-name="${item.name || ''}" data-name-zh="${nameZh}" data-intl="${item.intl ? 1 : 0}">
          <div class="airport-row1">
            <span class="${codeClass}">${highlightedCode}</span>
            <span class="airport-names">${namesHtml}</span>
          </div>
          <div class="airport-row2">
            <span class="airport-city">${item.city}</span>
            ${typeTag}
          </div>
        </div>
      `;
    } else {
      // 海外仓格式 - 与列表视图一致
      if (item.categoryName && item.categoryName.includes('亚马逊')) {
        categoryAttr = 'data-category="amazon"';
      } else if (item.categoryName && item.categoryName.includes('沃尔玛')) {
        categoryAttr = 'data-category="walmart"';
      } else {
        categoryAttr = 'data-category="freight"';
      }
      
      // 处理地址
      let address = item.address || '';
      address = address
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .trim();
      
      // 获取州名中文
      const stateCode = item.state || '';
      const stateZh = state.usStatesZh?.states?.[stateCode] || '';
      const stateLabel = stateCode ? `<span class="warehouse-state">${stateCode}${stateZh ? ' ' + stateZh : ''}</span>` : '';
      
      // 类型标签
      const typeLabel = item.type ? `<span class="warehouse-type-tag">${item.type}</span>` : '';
      
      const addressLine = address ? `<div class="result-item__address">${address}</div>` : '';
      const addressAttr = address ? `data-address="${address.replace(/"/g, '&quot;')}"` : '';
      
      itemHtml = `
        <div class="suggestion-item suggestion-item--warehouse" data-index="${index}" data-lat="${item.lat}" data-lng="${item.lng}" data-type="${item._type}" data-code="${code}" ${categoryAttr} ${addressAttr}>
          <div class="result-item__title">
            <span class="warehouse-code-group">${highlightedCode} ${typeLabel}</span>
            ${stateLabel}
          </div>
          ${addressLine}
        </div>
      `;
    }
    
    return itemHtml;
  }).join('');
  
  searchSuggestions.innerHTML = html;
  searchSuggestions.classList.add('search-suggestions--visible');
  
  // 绑定分类点击事件
  searchSuggestions.querySelectorAll('.suggestion-category').forEach(cat => {
    cat.addEventListener('click', () => {
      const tab = cat.dataset.tab;
      hideSuggestions();
      switchHubTab(tab);
      applyFilters();
    });
  });
  
  // 绑定结果项点击事件
  searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      const type = item.dataset.type;
      const code = item.dataset.code;
      
      // 更新输入框
      searchInput.value = code;
      hideSuggestions();
      
      // 切换到对应Tab
      if (type === 'airport') {
        switchHubTab('airports');
      } else if (type === 'port') {
        switchHubTab('ports');
      } else {
        switchHubTab('warehouses');
      }
      
      // 跳转地图（带类型图标和节点信息）
      if (!isNaN(lat) && !isNaN(lng)) {
        const category = item.dataset.category || null;
        const nodeInfo = {
          code: item.dataset.code || '',
          name: item.dataset.name || '',
          nameZh: item.dataset.nameZh || '',
          intl: item.dataset.intl === '1'
        };
        mapAdapter.focusOnCoords(lat, lng, 12, type, category, nodeInfo);
      }
      
      // 应用过滤
      applyFilters();
    });
  });
}

function hideSuggestions() {
  searchSuggestions.classList.remove('search-suggestions--visible');
  searchSuggestions.innerHTML = '';
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

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
  
  // 机场/港口/海外仓 Tab 切换
  tabAirports.addEventListener("click", () => switchHubTab('airports'));
  tabPorts.addEventListener("click", () => switchHubTab('ports'));
  tabWarehouses.addEventListener("click", () => switchHubTab('warehouses'));
  
  // 初始化地址搜索（使用服务端代理）
  initAddressSearch();
  
  // 机场/港口/海外仓搜索 - 带联想功能
  let debounceTimer;
  let suggestionIndex = -1;
  
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    suggestionIndex = -1;
    debounceTimer = setTimeout(() => {
      showSearchSuggestions();
    }, 100);
  });
  
  // 键盘导航联想列表
  searchInput.addEventListener("keydown", (e) => {
    const items = searchSuggestions.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
      updateSuggestionSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestionIndex = Math.max(suggestionIndex - 1, 0);
      updateSuggestionSelection(items);
    } else if (e.key === "Enter" && suggestionIndex >= 0) {
      e.preventDefault();
      items[suggestionIndex].click();
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });
  
  function updateSuggestionSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle("suggestion-item--selected", i === suggestionIndex);
    });
  }
  
  // 点击外部关闭联想
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
      hideSuggestions();
    }
  });
  
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim().length >= 1) {
      showSearchSuggestions();
    }
  });
  
  resultsList.addEventListener("click", (event) => {
    const item = event.target.closest(".result-item");
    if (!item || item.classList.contains("result-item--hint")) return;
    
    // 搜索结果点击：使用坐标跳转（带类型图标）
    if (item.classList.contains("result-item--search")) {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      const type = item.dataset.type || 'airport';
      const category = item.dataset.category || null;
      if (!isNaN(lat) && !isNaN(lng)) {
        // 构建节点信息用于 popup 显示
        const nodeInfo = {
          code: item.dataset.code || '',
          name: item.dataset.name || '',
          nameZh: item.dataset.nameZh || '',
          intl: item.dataset.intl === '1',
          address: item.dataset.address || ''
        };
        // 清除批量标记，避免与类型图标重叠
        mapAdapter.setMarkers([]);
        // 仓库用更大的缩放级别
        const zoomLevel = type === 'warehouse' ? 14 : 12;
        mapAdapter.focusOnCoords(lat, lng, zoomLevel, type, category, nodeInfo);
        if (window.innerWidth <= 768) {
          app.classList.remove("app--sidebar-open");
        }
      }
      return;
    }
    
    // 其他情况：通过 id 查找节点
    const node = state.filteredNodes.find((n) => n.id === item.dataset.id);
    if (node) {
      mapAdapter.focusOn(node);
      // 移动端：点击结果后关闭侧边栏
      if (window.innerWidth <= 768) {
        app.classList.remove("app--sidebar-open");
      }
    }
  });

  // 侧边栏切换逻辑
  const isMobile = () => window.innerWidth <= 768;
  
  const toggleSidebar = () => {
    if (isMobile()) {
      // 移动端：切换 app--sidebar-open
      app.classList.toggle("app--sidebar-open");
    } else {
      // 桌面端：切换 app--collapsed
      app.classList.toggle("app--collapsed");
    }
  };

  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarFloatingToggle.addEventListener("click", toggleSidebar);
}

async function loadData() {
  resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">加载数据中...</div></li>';
  
  try {
    // 使用 requestIdleCallback 或 setTimeout 延迟加载数据，让地图先渲染
    await new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(resolve, { timeout: 500 });
      } else {
        setTimeout(resolve, 100);
      }
    });

    const [airports, ports, airportsClassified, portsClassified, warehousesData] = await Promise.all([
      fetch("/data/airports.json").then((res) => res.json()),
      fetch("/data/ports.json").then((res) => res.json()),
      fetch("/data/airports-classified.json").then((res) => res.json()).catch(() => null),
      fetch("/data/ports-classified.json").then((res) => res.json()).catch(() => null),
      fetch("/data/warehouses.json").then((res) => res.json()).catch(() => null)
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
    state.airportsClassified = airportsClassified;
    state.portsClassified = portsClassified;
    state.warehousesData = warehousesData;
    
    // 加载美国州名中文数据
    try {
      const usStatesRes = await fetch("/data/us-states-zh.json");
      state.usStatesZh = await usStatesRes.json();
    } catch (e) {
      state.usStatesZh = null;
    }
    
    // 更新 Tab 数量
    updateTabCounts();
    
    // 分批渲染标记，避免阻塞
    requestAnimationFrame(() => {
      applyFilters();
    });
  } catch (error) {
    resultsList.innerHTML = '<li class="result-item"><div class="result-item__meta">数据加载失败，请刷新重试</div></li>';
    console.error("Failed to load data:", error);
  }
}

wireEvents();
loadData();
loadRemoteAreas(); // 加载偏远地区数据
loadCityNamesZh(); // 加载中英文对照数据

// 注册 Service Worker 缓存瓦片
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // 静默失败，不影响使用
  });
}

