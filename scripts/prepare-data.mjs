import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_DIR = path.join(ROOT, "public", "data");

const AIRPORTS_CSV = path.join(RAW_DIR, "airports.csv");
const UNLOCODE_CSV = path.join(RAW_DIR, "unlocode.csv");

// 常用国家中英文映射
const COUNTRY_CN = {
  US: "美国", CN: "中国", JP: "日本", KR: "韩国", DE: "德国",
  GB: "英国", FR: "法国", IT: "意大利", ES: "西班牙", CA: "加拿大",
  AU: "澳大利亚", BR: "巴西", IN: "印度", RU: "俄罗斯", MX: "墨西哥",
  ID: "印度尼西亚", TH: "泰国", VN: "越南", MY: "马来西亚", SG: "新加坡",
  PH: "菲律宾", AE: "阿联酋", SA: "沙特", TR: "土耳其", NL: "荷兰",
  BE: "比利时", CH: "瑞士", AT: "奥地利", SE: "瑞典", NO: "挪威",
  DK: "丹麦", FI: "芬兰", PL: "波兰", CZ: "捷克", PT: "葡萄牙",
  GR: "希腊", IE: "爱尔兰", NZ: "新西兰", ZA: "南非", EG: "埃及",
  AR: "阿根廷", CL: "智利", CO: "哥伦比亚", PE: "秘鲁", VE: "委内瑞拉",
  HK: "香港", TW: "台湾", MO: "澳门", PK: "巴基斯坦", BD: "孟加拉"
};

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true
  });
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseCoordinates(coordText) {
  if (!coordText) return null;
  const match = coordText.trim().match(/^(\d{2})(\d{2})([NS])\s*(\d{3})(\d{2})([EW])$/);
  if (!match) return null;
  const latDeg = Number(match[1]);
  const latMin = Number(match[2]);
  const latDir = match[3];
  const lonDeg = Number(match[4]);
  const lonMin = Number(match[5]);
  const lonDir = match[6];
  if (![latDeg, latMin, lonDeg, lonMin].every(Number.isFinite)) return null;
  let lat = latDeg + latMin / 60;
  let lon = lonDeg + lonMin / 60;
  if (latDir === "S") lat *= -1;
  if (lonDir === "W") lon *= -1;
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lon * 10000) / 10000 };
}

function buildAirports() {
  const rows = parseCsv(AIRPORTS_CSV);
  const allowedTypes = new Set(["large_airport", "medium_airport", "small_airport"]);
  return rows
    .filter((row) => allowedTypes.has(row.type))
    .filter((row) => row.iata_code || row.scheduled_service === "yes")
    .map((row) => {
      const lat = toNumber(row.latitude_deg);
      const lng = toNumber(row.longitude_deg);
      if (lat === null || lng === null) return null;
      const iata = (row.iata_code || "").trim();
      const icao = (row.icao_code || row.ident || "").trim();
      const code = iata || icao;
      if (!code) return null;
      const countryCode = row.iso_country;
      const countryCn = COUNTRY_CN[countryCode] || "";
      return {
        id: `a-${code}`.toLowerCase(),
        code,
        icao,
        name: row.name,
        country: countryCn ? `${countryCode} ${countryCn}` : countryCode,
        city: row.municipality || "",
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000
      };
    })
    .filter(Boolean);
}

function buildPorts() {
  const rows = parseCsv(UNLOCODE_CSV);
  return rows
    .filter((row) => typeof row.Function === "string" && row.Function[0] === "1")
    .map((row) => {
      const coords = parseCoordinates(row.Coordinates);
      if (!coords) return null;
      const code = `${row.Country}${row.Location}`.trim();
      if (!code) return null;
      const countryCode = row.Country;
      const countryCn = COUNTRY_CN[countryCode] || "";
      return {
        id: `p-${code}`.toLowerCase(),
        code,
        name: row.Name || row.NameWoDiacritics || code,
        country: countryCn ? `${countryCode} ${countryCn}` : countryCode,
        city: row.Name || "",
        lat: coords.lat,
        lng: coords.lng
      };
    })
    .filter(Boolean);
}

function writeJson(fileName, data) {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  const target = path.join(OUT_DIR, fileName);
  // 输出压缩的 JSON（无空格）
  fs.writeFileSync(target, JSON.stringify(data));
}

function main() {
  if (!fs.existsSync(AIRPORTS_CSV)) {
    throw new Error(`Missing airports CSV at ${AIRPORTS_CSV}`);
  }
  if (!fs.existsSync(UNLOCODE_CSV)) {
    throw new Error(`Missing UN/LOCODE CSV at ${UNLOCODE_CSV}`);
  }

  const airports = buildAirports();
  const ports = buildPorts();

  writeJson("airports.json", airports);
  writeJson("ports.json", ports);

  // 计算文件大小
  const airportSize = (fs.statSync(path.join(OUT_DIR, "airports.json")).size / 1024).toFixed(1);
  const portSize = (fs.statSync(path.join(OUT_DIR, "ports.json")).size / 1024).toFixed(1);

  console.log(`Airports: ${airports.length} (${airportSize} KB)`);
  console.log(`Ports: ${ports.length} (${portSize} KB)`);
}

main();
