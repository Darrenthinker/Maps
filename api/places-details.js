// Vercel Edge Function - 代理 Google Places Details API

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const placeId = url.searchParams.get('place_id');

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!placeId) {
    return new Response(JSON.stringify({ error: 'Missing place_id parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Google Places API Key
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA-8x6r7r8V2JOI8dgFzwxDLQApIwGaf30';

  try {
    const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    googleUrl.searchParams.set('place_id', placeId);
    googleUrl.searchParams.set('key', API_KEY);
    googleUrl.searchParams.set('fields', 'formatted_address,geometry,name');
    googleUrl.searchParams.set('language', 'zh-CN');

    const response = await fetch(googleUrl.toString());
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Places Details Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch place details' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
