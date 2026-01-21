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
    zoomControl: false,  // 禁用默认左上角缩放控件
    preferCanvas: true   // 使用 Canvas 渲染，性能更好
  });

  // 将缩放控件添加到右下角（类似谷歌地图）
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 定义多个瓦片源，按优先级排列（国内访问友好）
  const tileSources = [
    // 主源：Carto Voyager（全球 CDN）
    {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd'
      }
    },
    // 备用源1：Carto Light（更轻量）
    {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd'
      }
    },
    // 备用源2：OSM 官方 CDN
    {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    }
  ];

  let currentSourceIndex = 0;
  let tileLayer = null;
  let failedTiles = 0;
  const MAX_FAILED_TILES = 5; // 超过这个数量就切换源

  function createTileLayer(sourceIndex) {
    const source = tileSources[sourceIndex];
    const layer = L.tileLayer(source.url, {
      ...source.options,
      noWrap: false,
      bounds: bounds,
      crossOrigin: true,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // 透明1x1像素
    });

    // 监听瓦片加载错误
    layer.on('tileerror', function(e) {
      failedTiles++;
      console.warn(`瓦片加载失败 (${failedTiles}/${MAX_FAILED_TILES}):`, e.tile.src);
      
      // 如果失败次数过多，切换到备用源
      if (failedTiles >= MAX_FAILED_TILES && currentSourceIndex < tileSources.length - 1) {
        console.log('切换到备用瓦片源...');
        switchToNextSource();
      }
    });

    // 瓦片加载成功时重置计数
    layer.on('tileload', function() {
      failedTiles = Math.max(0, failedTiles - 1);
    });

    return layer;
  }

  function switchToNextSource() {
    currentSourceIndex++;
    failedTiles = 0;
    
    if (tileLayer) {
      map.removeLayer(tileLayer);
    }
    
    tileLayer = createTileLayer(currentSourceIndex);
    tileLayer.addTo(map);
    console.log(`已切换到瓦片源 ${currentSourceIndex + 1}/${tileSources.length}`);
  }

  // 初始化瓦片层
  tileLayer = createTileLayer(0);
  tileLayer.addTo(map);

  // 优化 MarkerCluster 配置，提升性能
  const clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,           // 分批加载标记
    chunkInterval: 100,             // 每批间隔（ms）
    chunkDelay: 50,                 // 延迟渲染
    removeOutsideVisibleBounds: true, // 移除视野外的标记
    animate: false,                 // 禁用动画，提升性能
    disableClusteringAtZoom: 10,    // 缩放级别10以上不聚合
    maxClusterRadius: 80,           // 聚合半径
    spiderfyOnMaxZoom: true
  });
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

