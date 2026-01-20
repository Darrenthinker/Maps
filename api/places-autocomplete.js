// Vercel Serverless Function - 代理 Google Places Autocomplete API
// 这样国内用户无需VPN也能使用地址搜索

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { input, language = 'zh-CN' } = req.query;

  if (!input) {
    return res.status(400).json({ error: 'Missing input parameter' });
  }

  // Google Places API Key（存储在环境变量中更安全，但这里先硬编码）
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA-8x6r7r8V2JOI8dgFzwxDLQApIwGaf30';

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', language);

    const response = await fetch(url.toString());
    const data = await response.json();

    // 返回结果
    res.status(200).json(data);
  } catch (error) {
    console.error('Places Autocomplete Error:', error);
    res.status(500).json({ error: 'Failed to fetch autocomplete results' });
  }
}
