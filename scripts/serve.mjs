import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const index = process.argv.indexOf('--port');
const port = Number(index >= 0 ? process.argv[index + 1] : process.env.PORT || 5173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer(async (req, res) => {
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = route === '/' ? 'index.html' : route.slice(1);
    if (!(relative === 'index.html' || relative === 'favicon.svg' || /^src\/[\w.-]+\.(?:js|css)$/.test(relative))) {
      res.writeHead(404).end('Not found'); return;
    }
    const data = await readFile(path.join(root, relative));
    res.writeHead(200, {'Content-Type': types[path.extname(relative)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
