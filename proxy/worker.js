// Relais Pl@ntNet + stockage cloud — Cloudflare Worker.
// Secrets : PLANTNET_KEY (clé API), APP_TOKEN (mot de passe partagé avec l'app, conseillé).
// Binding KV : TREES (Settings → Bindings → KV namespace).
const ALLOWED_ORIGINS = ['https://jeevanbillot.github.io', 'http://localhost:8765'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (env.APP_TOKEN && req.headers.get('X-App-Token') !== env.APP_TOKEN) return json({ message: 'bad token' }, 401);

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // ---- Identification Pl@ntNet ----
    if (path === '/' || path === '/identify') {
      if (req.method !== 'POST') return json({ message: 'POST only' }, 405);
      const target = new URL('https://my-api.plantnet.org/v2/identify/all');
      target.searchParams.set('api-key', env.PLANTNET_KEY);
      for (const k of ['lang', 'nb-results', 'include-related-images', 'no-reject']) {
        if (url.searchParams.has(k)) target.searchParams.set(k, url.searchParams.get(k));
      }
      const up = await fetch(target, { method: 'POST', body: req.body, headers: { 'Content-Type': req.headers.get('Content-Type') } });
      return new Response(await up.arrayBuffer(), { status: up.status, headers: { ...cors, 'Content-Type': up.headers.get('Content-Type') || 'application/json' } });
    }

    // ---- Synchronisation (KV) ----
    if (!env.TREES) return json({ message: 'KV binding TREES manquant' }, 500);
    const readIndex = async () => (await env.TREES.get('index', 'json')) || {};

    if (path === '/sync/trees' && req.method === 'GET') {
      return json({ trees: Object.values(await readIndex()) });
    }
    let m;
    if ((m = path.match(/^\/sync\/tree\/([\w-]+)$/))) {
      const id = m[1];
      const idx = await readIndex();
      if (req.method === 'PUT') {
        const t = await req.json();
        if (!idx[id] || (t.updated || 0) >= (idx[id].updated || 0)) idx[id] = t;
        await env.TREES.put('index', JSON.stringify(idx));
        return json({ ok: true, tree: idx[id] });
      }
      if (req.method === 'DELETE') {
        delete idx[id];
        await env.TREES.put('index', JSON.stringify(idx));
        const list = await env.TREES.list({ prefix: `photo:${id}_` });
        for (const k of list.keys) await env.TREES.delete(k.name);
        return json({ ok: true });
      }
    }
    if ((m = path.match(/^\/sync\/photo\/([\w-]+)$/))) {
      const key = `photo:${m[1]}`;
      if (req.method === 'PUT') {
        await env.TREES.put(key, await req.arrayBuffer());
        return json({ ok: true });
      }
      if (req.method === 'GET') {
        const buf = await env.TREES.get(key, 'arrayBuffer');
        if (!buf) return json({ message: 'not found' }, 404);
        return new Response(buf, { headers: { ...cors, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
      }
    }
    return json({ message: 'not found' }, 404);
  }
};
