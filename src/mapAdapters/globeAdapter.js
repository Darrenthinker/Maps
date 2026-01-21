import Globe from "globe.gl";

export function createGlobeAdapter(mapId, options = {}) {
  const container = document.getElementById(mapId);
  
  // Create globe instance with high-res satellite imagery
  const globe = Globe()
    // Use high-resolution NASA satellite imagery
    .globeImageUrl("//cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-day.jpg")
    .bumpImageUrl("//cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-topology.png")
    .backgroundColor("#1a1a2e")
    .showAtmosphere(true)
    .atmosphereColor("#4a90d9")
    .atmosphereAltitude(0.2)
    .pointsData([])
    .pointLat("lat")
    .pointLng("lng")
    .pointColor(() => "#f59e0b")
    .pointAltitude(0.006)
    .pointRadius(0.1)
    .pointsMerge(true)
    .pointLabel((d) => `
      <div style="background: white; padding: 8px 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-family: system-ui, sans-serif;">
        <strong style="color: #1f2933;">${d.name}</strong><br/>
        <span style="color: #616e7c; font-size: 12px;">${d.city}, ${d.country}</span><br/>
        <span style="color: #3182ce; font-size: 12px;">${d.type === "airport" ? "IATA: " + d.code : "UNLOCODE: " + d.code}</span>
      </div>
    `)
    .onPointClick((point) => {
      globe.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.5 }, 1000);
    })
    .width(container.clientWidth)
    .height(container.clientHeight);

  globe(container);

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    globe.width(container.clientWidth).height(container.clientHeight);
  });
  resizeObserver.observe(container);

  // Initial view
  globe.pointOfView({ lat: 30, lng: 100, altitude: 2.0 });

  let cachedNodes = [];

  function setMarkers(nodes) {
    cachedNodes = nodes;
    // Sample data to reduce density for performance
    const sampleRate = nodes.length > 3000 ? Math.ceil(nodes.length / 3000) : 1;
    const sampledNodes = nodes.filter((_, i) => i % sampleRate === 0);
    globe.pointsData(sampledNodes);
  }

  function focusOn(node) {
    if (!node) return;
    globe.pointOfView({ lat: node.lat, lng: node.lng, altitude: 1.5 }, 1000);
  }

  return {
    setMarkers,
    focusOn,
    destroy: () => {
      resizeObserver.disconnect();
      globe._destructor && globe._destructor();
      container.innerHTML = "";
    }
  };
}

