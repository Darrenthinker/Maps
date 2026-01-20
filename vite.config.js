import { defineConfig } from 'vite';

// Google Places API Key
const GOOGLE_API_KEY = 'AIzaSyA-8x6r7r8V2JOI8dgFzwxDLQApIwGaf30';

export default defineConfig({
  server: {
    port: 2026,
    host: true,
    proxy: {
      // 本地开发时代理 API 请求到 Google（需要网络可访问 Google）
      // 部署到 Vercel 后会使用 /api 目录下的 Serverless Functions
      '/api/places-autocomplete': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const input = url.searchParams.get('input') || '';
          const language = url.searchParams.get('language') || 'zh-CN';
          return `/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&language=${language}&key=${GOOGLE_API_KEY}`;
        }
      },
      '/api/places-details': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const placeId = url.searchParams.get('place_id') || '';
          return `/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,geometry,name&language=zh-CN&key=${GOOGLE_API_KEY}`;
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
