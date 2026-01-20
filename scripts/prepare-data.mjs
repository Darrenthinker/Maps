import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_DIR = path.join(ROOT, "public", "data");

const AIRPORTS_CSV = path.join(RAW_DIR, "airports.csv");
const UNLOCODE_CSV = path.join(RAW_DIR, "unlocode.csv");

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
  return { lat, lng: lon };
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
      return {
        id: `airport-${row.ident || code}`.toLowerCase(),
        code,
        icao,
        name: row.name,
        country: row.iso_country,
        city: row.municipality || "",
        lat,
        lng
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
      return {
        id: `port-${code}`.toLowerCase(),
        code,
        name: row.Name || row.NameWoDiacritics || code,
        country: row.Country,
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
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
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

  console.log(`Airports: ${airports.length}`);
  console.log(`Ports: ${ports.length}`);
}

main();
