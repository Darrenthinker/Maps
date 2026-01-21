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

  // 定义多个瓦片源，按优先级排列
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
    // 备用源1：OSM DE 服务器（德国，稳定）
    {
      url: "https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abc'
      }
    },
    // 备用源2：OSM FR 服务器（法国，稳定）
    {
      url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abc'
      }
    },
    // 备用源3：OSM 官方
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
      useCache: true,           // 启用缓存
      crossOrigin: 'anonymous', // 允许缓存跨域瓦片
      cacheMaxAge: 86400 * 7    // 缓存7天
    });

    // 瓦片重试机制
    const retryCount = new Map(); // 记录每个瓦片的重试次数
    const MAX_RETRIES = 3;

    // 监听瓦片加载错误
    layer.on('tileerror', function(e) {
      const tile = e.tile;
      const src = tile.src;
      
      // 获取当前重试次数
      const currentRetry = retryCount.get(src) || 0;
      
      if (currentRetry < MAX_RETRIES) {
        // 延迟重试
        retryCount.set(src, currentRetry + 1);
        setTimeout(() => {
          tile.src = src; // 重新加载瓦片
        }, 500 * (currentRetry + 1)); // 递增延迟：500ms, 1000ms, 1500ms
      } else {
        // 超过重试次数，计入失败
        failedTiles++;
        console.warn(`瓦片加载失败 (重试${MAX_RETRIES}次后):`, src);
        
        // 如果失败次数过多，切换到备用源
        if (failedTiles >= MAX_FAILED_TILES && currentSourceIndex < tileSources.length - 1) {
          console.log('切换到备用瓦片源...');
          switchToNextSource();
        }
      }
    });

    // 瓦片加载成功时清除重试记录
    layer.on('tileload', function(e) {
      retryCount.delete(e.tile.src);
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

  // 用于两地距离显示
  let distanceMarkerA = null;
  let distanceMarkerB = null;
  let distanceLine = null;

  function showDistanceLine(pointA, pointB) {
    // 清除之前的标记和线
    clearDistanceLine();

    // 创建 A 点标记（红色📍）
    const iconA = L.divIcon({
      className: "marker marker-address marker-point-a",
      html: "📍"
    });
    distanceMarkerA = L.marker([pointA.lat, pointA.lng], { icon: iconA }).addTo(map);
    distanceMarkerA.bindPopup(`<strong>🅰️ 起点</strong><br/>${pointA.name}`);

    // 创建 B 点标记（绿色📍）
    const iconB = L.divIcon({
      className: "marker marker-address marker-point-b",
      html: "📍"
    });
    distanceMarkerB = L.marker([pointB.lat, pointB.lng], { icon: iconB }).addTo(map);
    distanceMarkerB.bindPopup(`<strong>🅱️ 终点</strong><br/>${pointB.name}`);

    // 创建连接线（虚线）
    distanceLine = L.polyline(
      [[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]],
      {
        color: '#2563eb',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 8',
        lineCap: 'round'
      }
    ).addTo(map);

    // 调整视野让两个点都可见
    const bounds = L.latLngBounds(
      [pointA.lat, pointA.lng],
      [pointB.lat, pointB.lng]
    );
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }

  function clearDistanceLine() {
    if (distanceMarkerA) {
      map.removeLayer(distanceMarkerA);
      distanceMarkerA = null;
    }
    if (distanceMarkerB) {
      map.removeLayer(distanceMarkerB);
      distanceMarkerB = null;
    }
    if (distanceLine) {
      map.removeLayer(distanceLine);
      distanceLine = null;
    }
  }

  return {
    setMarkers,
    focusOn,
    focusOnCoords,
    showDistanceLine,
    clearDistanceLine,
    destroy: () => map.remove()
  };
}

