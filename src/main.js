import "./style.css";
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
  filteredNodes: []
};

function normalize(text) {
  return text.toLowerCase().trim();
}

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

function matchesQuery(node, query) {
  if (!query) return true;
  const haystack = [
    node.name,
    node.city,
    node.country,
    node.code,
    node.icao || ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function applyFilters() {
  const query = normalize(searchInput.value);
  const showAirports = filterAirports.checked;
  const showPorts = filterPorts.checked;

  state.filteredNodes = state.allNodes.filter((node) => {
    if (node.type === "airport" && !showAirports) return false;
    if (node.type === "port" && !showPorts) return false;
    return matchesQuery(node, query);
  });

  renderResults();
  mapAdapter.setMarkers(state.filteredNodes);
}

function renderResults() {
  resultsCount.textContent = String(state.filteredNodes.length);
  resultsList.innerHTML = state.filteredNodes
    .map((node) => {
      const code = node.type === "airport" ? node.code : node.code;
      const sub = node.type === "airport" ? "机场" : "港口";
      return `
        <li class="result-item" data-id="${node.id}">
          <div class="result-item__title">${code} · ${node.name}</div>
          <div class="result-item__meta">${node.city}, ${node.country} · ${sub}</div>
        </li>
      `;
    })
    .join("");
}

function wireEvents() {
  searchInput.addEventListener("input", applyFilters);
  filterAirports.addEventListener("change", applyFilters);
  filterPorts.addEventListener("change", applyFilters);
  resultsList.addEventListener("click", (event) => {
    const item = event.target.closest(".result-item");
    if (!item) return;
    const node = state.filteredNodes.find((n) => n.id === item.dataset.id);
    mapAdapter.focusOn(node);
  });

  const toggleSidebar = () => {
    app.classList.toggle("app--collapsed");
  };

  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarFloatingToggle.addEventListener("click", toggleSidebar);
}

async function loadData() {
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
}

// 手机端默认折叠侧边栏
if (window.innerWidth <= 768) {
  app.classList.add("app--collapsed");
}

wireEvents();
loadData();
