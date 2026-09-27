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
    // Un enregistrement par arbre (clé « t:<id> ») : deux enregistrements simultanés ne peuvent plus s'écraser.
    // L'ancien format (tout dans la clé « index ») est migré automatiquement au premier chargement.
    async function allTrees() {
      const legacy = await env.TREES.get('index', 'json');
      if (legacy) { for (const t of Object.values(legacy)) if (t && t.id) await env.TREES.put(`t:${t.id}`, JSON.stringify(t)); await env.TREES.delete('index'); }
      const keys = []; let cursor;
      do { const l = await env.TREES.list({ prefix: 't:', cursor }); keys.push(...l.keys.map(k => k.name)); cursor = l.list_complete ? null : l.cursor; } while (cursor);
      const out = {};
      for (const t of await Promise.all(keys.map(k => env.TREES.get(k, 'json')))) if (t && t.id && (!out[t.id] || (t.updated || 0) >= (out[t.id].updated || 0))) out[t.id] = t;
      if (legacy) for (const t of Object.values(legacy)) if (t && t.id && !out[t.id]) out[t.id] = t;
      return Object.values(out);
    }

    if (path === '/sync/trees' && req.method === 'GET') {
      return new Response(JSON.stringify({ trees: await allTrees() }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    let m;
    if ((m = path.match(/^\/sync\/tree\/([\w-]+)$/))) {
      const id = m[1], key = `t:${id}`;
      if (req.method === 'PUT') {
        const t = await req.json(), cur = await env.TREES.get(key, 'json');
        if (!cur || (t.updated || 0) >= (cur.updated || 0)) { await env.TREES.put(key, JSON.stringify(t)); return json({ ok: true, tree: t }); }
        return json({ ok: true, tree: cur, stale: true });
      }
      if (req.method === 'DELETE') {
        await env.TREES.delete(key);
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
