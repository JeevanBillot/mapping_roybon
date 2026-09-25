// Relais Pl@ntNet — Cloudflare Worker.
// Secrets à définir dans le Worker : PLANTNET_KEY (clé API), et facultatif APP_TOKEN (mot de passe partagé avec l'app).
const ALLOWED_ORIGINS = ['https://jeevanbillot.github.io', 'http://localhost:8765'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
    if (env.APP_TOKEN && req.headers.get('X-App-Token') !== env.APP_TOKEN) return new Response('{"message":"bad token"}', { status: 401, headers: cors });

    const url = new URL(req.url);
    const target = new URL('https://my-api.plantnet.org/v2/identify/all');
    target.searchParams.set('api-key', env.PLANTNET_KEY);
    for (const k of ['lang', 'nb-results', 'include-related-images', 'no-reject']) {
      if (url.searchParams.has(k)) target.searchParams.set(k, url.searchParams.get(k));
    }
    const upstream = await fetch(target, { method: 'POST', body: req.body, headers: { 'Content-Type': req.headers.get('Content-Type') } });
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: upstream.status, headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' } });
  }
};
