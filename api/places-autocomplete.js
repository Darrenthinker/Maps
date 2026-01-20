// Vercel Serverless Function - 代理 Google Places Autocomplete API

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const input = url.searchParams.get('input');
  const language = url.searchParams.get('language') || 'zh-CN';

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!input) {
    return new Response(JSON.stringify({ error: 'Missing input parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Google Places API Key
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA-8x6r7r8V2JOI8dgFzwxDLQApIwGaf30';

  try {
    const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    googleUrl.searchParams.set('input', input);
    googleUrl.searchParams.set('key', API_KEY);
    googleUrl.searchParams.set('language', language);

    const response = await fetch(googleUrl.toString());
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Places Autocomplete Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch autocomplete results' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
