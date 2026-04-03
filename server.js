// vHandling Relay Server
// Hosted on Railway/Render — bridges Editor ↔ FiveM Resource
//
// Flow:
//   Editor  → POST /push?token=X  { handling JSON }
//   FiveM   → GET  /poll?token=X  → returns handling JSON once, then clears

const http = require('http');

// In-memory store: token → { type, handling, ts }
const queue = new Map();

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of queue) {
    if (now - v.ts > 60000) queue.delete(k);
  }
}, 60000);

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url   = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');

  // CORS headers — FiveM needs these
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (!token) {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: 'Missing token' }));
    return;
  }

  // ── GET /poll — FiveM polls here ─────────────────────
  if (req.method === 'GET' && url.pathname === '/poll') {
    const entry = queue.get(token);
    if (!entry) {
      res.writeHead(200);
      res.end(JSON.stringify({ type: 'none' }));
      return;
    }
    // Return once then clear
    queue.delete(token);
    res.writeHead(200);
    res.end(JSON.stringify(entry));
    return;
  }

  // ── POST /push — Editor pushes handling data ──────────
  if (req.method === 'POST' && url.pathname === '/push') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        queue.set(token, {
          type:     data.type || 'apply',
          handling: data.handling || null,
          ts:       Date.now(),
        });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ── GET / — health check ──────────────────────────────
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, service: 'vHandling Relay', version: '1.0.0' }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[vHandling Relay] Running on port ${PORT}`);
});
