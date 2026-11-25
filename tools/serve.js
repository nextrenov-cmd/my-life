// 開発・端末確認用の簡易サーバー（依存なし）。npm start → http://localhost:8080
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

http
  .createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root) || /[\\/](tools|node_modules|\.git)[\\/]/.test(file.slice(root.length))) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .on('error', (e) => {
    // すでに起動している場合は何もしない
    if (e.code === 'EADDRINUSE') process.exit(0);
    throw e;
  })
  .listen(port, '127.0.0.1', () => console.log(`MY LIFE: http://localhost:${port}`));
