import { createLeafletAdapter } from "./leafletAdapter.js";
import { createGlobeAdapter } from "./globeAdapter.js";

export function createMapAdapter(mapId, provider = "leaflet", options = {}) {
  if (provider === "leaflet") {
    return createLeafletAdapter(mapId);
  }
  if (provider === "globe") {
    return createGlobeAdapter(mapId, options);
  }
  throw new Error(`Unsupported map provider: ${provider}`);
}
