/* Minimal stand-in for Vercel's routing so the API can be exercised locally:
   /api/foo/bar -> api/foo/bar.js, everything else served as a static file. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = require('path').resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 8790);

const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    const file = path.join(ROOT, pathname.replace(/\/$/, '') + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('no route ' + pathname); }
    delete require.cache[require.resolve(file)];
    try {
      const handler = require(file);
      await handler(req, res);
    } catch (e) {
      console.error('handler threw:', e);
      if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })); }
    }
    return;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

server.listen(PORT, () => console.log('dev server on http://localhost:' + PORT));
