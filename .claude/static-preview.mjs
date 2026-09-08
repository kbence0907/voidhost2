import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = normalize(join(process.cwd(), 'public'));
const PORT = 8091;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json',
  '.woff2':'font/woff2', '.woff':'font/woff'
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/' ) p = '/index.html';
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    let body;
    try { body = await readFile(file); }
    catch { // try .html fallback (extensionless routes)
      try { body = await readFile(file + '.html'); file += '.html'; }
      catch { res.writeHead(404); return res.end('not found'); }
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
server.listen(PORT, () => console.log('static preview on http://localhost:' + PORT));
