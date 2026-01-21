// Service Worker - 缓存地图瓦片
const CACHE_NAME = 'map-tiles-v1';
const TILE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天

// 瓦片 URL 匹配模式
const TILE_PATTERNS = [
  /basemaps\.cartocdn\.com/,
  /tile\.openstreetmap\./,
  /tianditu\.gov\.cn/
];

// 安装时不预缓存，按需缓存
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // 只缓存瓦片请求
  const isTile = TILE_PATTERNS.some(pattern => pattern.test(url));
  
  if (isTile) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // 先检查缓存
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 没有缓存，从网络获取
        try {
          const networkResponse = await fetch(event.request);
          
          // 成功获取后缓存
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          
          return networkResponse;
        } catch (error) {
          // 网络失败，返回空白瓦片
          return new Response('', { status: 408 });
        }
      })
    );
  }
});
