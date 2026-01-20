// Vercel Serverless Function - 代理 Google Places Details API
// 获取地点的详细信息（经纬度等）

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { place_id } = req.query;

  if (!place_id) {
    return res.status(400).json({ error: 'Missing place_id parameter' });
  }

  // Google Places API Key
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA-8x6r7r8V2JOI8dgFzwxDLQApIwGaf30';

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', place_id);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('fields', 'formatted_address,geometry,name');
    url.searchParams.set('language', 'zh-CN');

    const response = await fetch(url.toString());
    const data = await response.json();

    // 返回结果
    res.status(200).json(data);
  } catch (error) {
    console.error('Places Details Error:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
}
