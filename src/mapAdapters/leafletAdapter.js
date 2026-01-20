export function createLeafletAdapter(mapId) {
  // 设置地图边界，防止拖出地图范围
  const bounds = L.latLngBounds(
    L.latLng(-85, -180),
    L.latLng(85, 180)
  );

  const map = L.map(mapId, {
    center: [34, -118],
    zoom: 7,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    noWrap: false,
    bounds: bounds
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  const markerById = new Map();

  function buildIcon(type) {
    const className = type === "airport" ? "marker marker-airport" : "marker marker-port";
    const label = type === "airport" ? "A" : "P";
    return L.divIcon({ className, html: label });
  }

  function clearMarkers() {
    clusterGroup.clearLayers();
    markerById.clear();
  }

  function setMarkers(nodes) {
    clearMarkers();
    nodes.forEach((node) => {
      const marker = L.marker([node.lat, node.lng], {
        icon: buildIcon(node.type),
        title: node.name
      });
      marker.bindPopup(node.popupHtml);
      marker.on("click", () => {
        marker.openPopup();
      });
      clusterGroup.addLayer(marker);
      markerById.set(node.id, marker);
    });
  }

  function focusOn(node) {
    if (!node) return;
    map.setView([node.lat, node.lng], 6, { animate: true });
    const marker = markerById.get(node.id);
    if (marker) {
      marker.openPopup();
    }
  }

  // 用于地址搜索，定位到任意坐标
  let addressMarker = null;
  function focusOnCoords(lat, lng, zoom = 10) {
    map.setView([lat, lng], zoom, { animate: true });
    
    // 移除旧的地址标记
    if (addressMarker) {
      map.removeLayer(addressMarker);
    }
    
    // 添加新的地址标记
    const icon = L.divIcon({
      className: "marker marker-address",
      html: "📍"
    });
    addressMarker = L.marker([lat, lng], { icon }).addTo(map);
  }

  return {
    setMarkers,
    focusOn,
    focusOnCoords,
    destroy: () => map.remove()
  };
}
