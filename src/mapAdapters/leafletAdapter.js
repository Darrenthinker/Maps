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
      crossOrigin: 'anonymous'
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

  // 用于地址搜索和机场/港口/海外仓定位
  let addressMarker = null;
  let currentMarkerType = null;
  let currentMarkerCategory = null;
  
  // 根据缩放级别计算图标大小
  function getIconSizeByZoom(zoom) {
    // 缩放级别越高（放大），图标正常；缩放级别越低（缩小），图标更小
    if (zoom >= 14) return 26;      // 放大时
    if (zoom >= 12) return 24;      // 正常大小
    if (zoom >= 10) return 20;      // 稍微缩小
    if (zoom >= 8) return 16;       // 继续缩小
    if (zoom >= 6) return 12;       // 更小
    if (zoom >= 4) return 10;       // 很小
    return 8;                        // 最小尺寸
  }
  
  // 根据类型获取图标
  function getMarkerIcon(type, category, zoom = 12) {
    let html = "📍";
    let className = "marker marker-address";
    const size = getIconSizeByZoom(zoom);
    const fontSize = Math.max(14, size - 6);
    
    if (type === 'airport') {
      html = "✈️";
      className = "marker marker-type marker-airport-icon";
    } else if (type === 'port') {
      html = "🚢";
      className = "marker marker-type marker-port-icon";
    } else if (type === 'warehouse') {
      // 根据分类显示不同图标
      if (category === 'amazon' || (category && category.includes('亚马逊'))) {
        // Amazon 箭头 A logo
        html = `<svg viewBox="0 0 100 100" width="${size}" height="${size}">
          <rect x="5" y="5" width="90" height="90" rx="8" fill="#232F3E"/>
          <text x="50" y="62" font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="white" text-anchor="middle">a</text>
          <path d="M30 72 Q50 82 70 72" stroke="#FF9900" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M65 68 L70 72 L66 77" stroke="#FF9900" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        className = "marker marker-type marker-warehouse-amazon";
      } else if (category === 'walmart' || (category && category.includes('沃尔玛'))) {
        // Walmart spark logo
        html = `<svg viewBox="0 0 100 100" width="${size}" height="${size}">
          <rect x="5" y="5" width="90" height="90" rx="8" fill="#0071CE"/>
          <g transform="translate(50,50)">
            <rect x="-4" y="-28" width="8" height="22" rx="4" fill="#FFC220"/>
            <rect x="-4" y="6" width="8" height="22" rx="4" fill="#FFC220"/>
            <rect x="-4" y="-28" width="8" height="22" rx="4" fill="#FFC220" transform="rotate(60)"/>
            <rect x="-4" y="6" width="8" height="22" rx="4" fill="#FFC220" transform="rotate(60)"/>
            <rect x="-4" y="-28" width="8" height="22" rx="4" fill="#FFC220" transform="rotate(120)"/>
            <rect x="-4" y="6" width="8" height="22" rx="4" fill="#FFC220" transform="rotate(120)"/>
          </g>
        </svg>`;
        className = "marker marker-type marker-warehouse-walmart";
      } else {
        // 货代仓库 - 纸箱 emoji
        html = "📦";
        className = "marker marker-type marker-warehouse-icon";
      }
    }
    
    return L.divIcon({
      className: `${className} marker-zoom-${zoom >= 12 ? 'large' : zoom >= 8 ? 'medium' : 'small'}`,
      html: html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }
  
  // 更新标记图标（缩放时调用）
  function updateMarkerIcon() {
    if (addressMarker && currentMarkerType) {
      const zoom = map.getZoom();
      const newIcon = getMarkerIcon(currentMarkerType, currentMarkerCategory, zoom);
      addressMarker.setIcon(newIcon);
    }
  }
  
  // 监听缩放事件，动态调整图标大小
  map.on('zoomend', updateMarkerIcon);
  
  function focusOnCoords(lat, lng, zoom = 10, type = null, category = null, nodeInfo = null) {
    map.setView([lat, lng], zoom, { animate: true });
    
    // 移除旧的地址标记
    if (addressMarker) {
      map.removeLayer(addressMarker);
    }
    
    // 保存当前标记类型
    currentMarkerType = type;
    currentMarkerCategory = category;
    
    // 添加新的标记（根据类型显示不同图标，禁用阴影）
    const icon = getMarkerIcon(type, category, zoom);
    addressMarker = L.marker([lat, lng], { 
      icon,
      shadowPane: null  // 禁用阴影
    }).addTo(map);
    
    // 如果有节点信息，绑定 popup 显示中英文
    if (nodeInfo) {
      const code = nodeInfo.code || '';
      const nameZh = nodeInfo.nameZh || '';
      const nameEn = nodeInfo.name || '';
      const typeLabel = type === 'airport' ? '机场' : (type === 'port' ? '港口' : '仓库');
      const intlLabel = nodeInfo.intl ? '国际' : '国内';
      
      let popupContent = `<div class="map-popup">`;
      popupContent += `<div class="map-popup__code">${code}</div>`;
      if (nameZh) {
        popupContent += `<div class="map-popup__name-zh">${nameZh}</div>`;
      }
      popupContent += `<div class="map-popup__name-en">${nameEn}</div>`;
      popupContent += `<div class="map-popup__meta">${intlLabel} · ${typeLabel}</div>`;
      popupContent += `</div>`;
      
      addressMarker.bindPopup(popupContent, {
        className: 'custom-popup',
        closeButton: false
      }).openPopup();
    }
  }

  // 用于两地距离显示
  let distanceMarkerA = null;
  let distanceMarkerB = null;
  let distanceLine = null;
  let distanceLabel = null;

  // 计算两点距离（公里）
  function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 路线线条
  let routeLine = null;

  async function showDistanceLine(pointA, pointB) {
    // 清除之前的标记和线
    clearDistanceLine();
    
    // 隐藏地址搜索的图钉标记，避免重复
    if (addressMarker) {
      map.removeLayer(addressMarker);
      addressMarker = null;
    }

    // 计算直线距离
    const straightKm = calcDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);

    // 简化地址名称（取前30个字符）
    const shortNameA = pointA.name.length > 30 ? pointA.name.substring(0, 30) + '...' : pointA.name;
    const shortNameB = pointB.name.length > 30 ? pointB.name.substring(0, 30) + '...' : pointB.name;

    // 创建 A 点标记（起点 - 蓝色小圆点 + 地址标签）
    const iconA = L.divIcon({
      className: "distance-point distance-point-a",
      html: `<div class="distance-point-label">${shortNameA}</div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    distanceMarkerA = L.marker([pointA.lat, pointA.lng], { icon: iconA }).addTo(map);

    // 创建 B 点标记（终点 - 红色小圆点 + 地址标签）
    const iconB = L.divIcon({
      className: "distance-point distance-point-b",
      html: `<div class="distance-point-label">${shortNameB}</div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    distanceMarkerB = L.marker([pointB.lat, pointB.lng], { icon: iconB }).addTo(map);

    // 尝试获取公路距离
    let routeDistance = null;
    let routeCoords = null;
    
    try {
      // 使用 OSRM Demo API 获取驾驶路线
      const url = `https://router.project-osrm.org/route/v1/driving/${pointA.lng},${pointA.lat};${pointB.lng},${pointB.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        routeDistance = data.routes[0].distance / 1000; // 米转公里
        routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // [lng,lat] -> [lat,lng]
      }
    } catch (error) {
      console.warn('获取路线失败，使用直线距离:', error);
    }

    // 如果有路线数据，显示实际路线；否则显示直线
    if (routeCoords && routeCoords.length > 0) {
      // 显示实际公路路线（蓝色实线）
      routeLine = L.polyline(routeCoords, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8
      }).addTo(map);

      // 同时显示直线（淡色虚线）
      distanceLine = L.polyline(
        [[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]],
        {
          color: '#94a3b8',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 5'
        }
      ).addTo(map);

      // 在路线中点添加距离标签（显示公路距离）
      const midIndex = Math.floor(routeCoords.length / 2);
      const midPoint = routeCoords[midIndex];
      const labelIcon = L.divIcon({
        className: "distance-label",
        html: `${Math.round(routeDistance)} km`,
        iconSize: [80, 28],
        iconAnchor: [40, 14]
      });
      distanceLabel = L.marker(midPoint, { icon: labelIcon, interactive: false }).addTo(map);

    } else {
      // 只显示直线
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

      // 在线的中点添加距离标签
      const midLat = (pointA.lat + pointB.lat) / 2;
      const midLng = (pointA.lng + pointB.lng) / 2;
      const labelIcon = L.divIcon({
        className: "distance-label",
        html: `${Math.round(straightKm)} km`,
        iconSize: [80, 28],
        iconAnchor: [40, 14]
      });
      distanceLabel = L.marker([midLat, midLng], { icon: labelIcon, interactive: false }).addTo(map);
    }

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
    if (routeLine) {
      map.removeLayer(routeLine);
      routeLine = null;
    }
    if (distanceLabel) {
      map.removeLayer(distanceLabel);
      distanceLabel = null;
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

