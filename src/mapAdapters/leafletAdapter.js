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
    maxBoundsViscosity: 1.0,
    zoomControl: false  // 禁用默认左上角缩放控件
  });

  // 将缩放控件添加到右下角（类似谷歌地图）
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 使用 Carto 瓦片服务（全球 CDN 加速，国内访问更快）
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
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
    const marker = markerById.get(node.id);
    if (marker) {
      // 使用 zoomToShowLayer 确保标记从聚合中显示出来，然后自动打开 popup
      clusterGroup.zoomToShowLayer(marker, function() {
        marker.openPopup();
      });
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
