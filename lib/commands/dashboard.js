/**
 * snip dashboard — a local web-based dashboard for managing and running snippets.
 *
 * Launches a local zero-dependency Node.js HTTP server on port 5500
 * and opens the dashboard in the user's default browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawnSync } = require('child_process');
const os = require('os');
const storage = require('../storage');
const { c } = require('../colors');
const { resolveRunner } = require('../exec');
const { setExitCode } = require('../cli-utils');

const DEFAULT_PORT = 5500;
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');

// Helper to open the browser
function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`, (err) => {
    if (err) {
      console.log(c.dim(`  Could not open browser automatically. Please open: `) + c.brand(url));
    }
  });
}

// Helper to read JSON request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// REST API Request Router
async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');

  try {
    // GET /api/snippets -> List all snippets (metadata only)
    if (pathname === '/api/snippets' && method === 'GET') {
      const list = storage.listSnippets();
      res.writeHead(200);
      return res.end(JSON.stringify(list));
    }

    // GET /api/snippets/:id -> Read snippet metadata + content
    const snippetMatch = pathname.match(/^\/api\/snippets\/([a-zA-Z0-9_-]+)$/);
    if (snippetMatch && method === 'GET') {
      const idOrName = snippetMatch[1];
      const snip = storage.getSnippetByIdOrName(idOrName);
      if (!snip) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Snippet not found' }));
      }
      const content = storage.readSnippetContent(snip);
      res.writeHead(200);
      return res.end(JSON.stringify({ ...snip, content }));
    }

    // POST /api/snippets -> Add new snippet
    if (pathname === '/api/snippets' && method === 'POST') {
      const body = await readBody(req);
      if (!body.name || !body.content) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Name and content are required' }));
      }
      const snip = storage.addSnippet({
        name: body.name,
        content: body.content,
        language: body.language || '',
        tags: body.tags || []
      });
      storage.flush();
      res.writeHead(201);
      return res.end(JSON.stringify(snip));
    }

    // PUT /api/snippets/:id -> Update snippet metadata & content
    if (snippetMatch && method === 'PUT') {
      const id = snippetMatch[1];
      const body = await readBody(req);
      const snip = storage.getSnippetByIdOrName(id);
      if (!snip) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Snippet not found' }));
      }

      // Update content if provided
      if (body.content !== undefined) {
        storage.updateSnippetContent(snip.id, body.content);
      }

      // Update metadata if provided
      if (body.name || body.language || body.tags) {
        storage.updateSnippetMeta(snip.id, {
          name: body.name || snip.name,
          language: body.language !== undefined ? body.language : snip.language,
          tags: body.tags || snip.tags
        });
      }

      storage.flush();
      res.writeHead(200);
      return res.end(JSON.stringify(storage.getSnippetByIdOrName(snip.id)));
    }

    // DELETE /api/snippets/:id -> Delete snippet
    if (snippetMatch && method === 'DELETE') {
      const id = snippetMatch[1];
      const snip = storage.getSnippetByIdOrName(id);
      if (!snip) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Snippet not found' }));
      }
      storage.deleteSnippetById(snip.id);
      storage.flush();
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true }));
    }

    // POST /api/snippets/:id/run -> Run snippet locally
    const runMatch = pathname.match(/^\/api\/snippets\/([a-zA-Z0-9_-]+)\/run$/);
    if (runMatch && method === 'POST') {
      const id = runMatch[1];
      const snip = storage.getSnippetByIdOrName(id);
      if (!snip) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Snippet not found' }));
      }

      const content = storage.readSnippetContent(snip);
      const runner = resolveRunner(snip.language);
      
      // Execute in temp file to capture output logs
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-web-run-'));
      const tmpFile = path.join(tmpDir, `run.${runner.extension}`);
      fs.writeFileSync(tmpFile, content, { mode: 0o700 });

      try {
        const resSpawn = spawnSync(runner.command, [tmpFile], { encoding: 'utf8', timeout: 10000 });
        fs.rmSync(tmpDir, { recursive: true, force: true });
        
        storage.touchUsage(snip);
        storage.flush();

        res.writeHead(200);
        return res.end(JSON.stringify({
          status: resSpawn.status !== null ? resSpawn.status : 1,
          output: resSpawn.stdout + resSpawn.stderr,
          error: resSpawn.error ? resSpawn.error.message : null
        }));
      } catch (err) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        res.writeHead(500);
        return res.end(JSON.stringify({ error: `Execution failed: ${err.message}` }));
      }
    }

    // Unknown endpoint
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));

  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function dashboardCmd(opts = {}) {
  const port = opts.port || DEFAULT_PORT;
  const url = `http://localhost:${port}`;

  const server = http.createServer((req, res) => {
    // API Requests
    if (req.url.startsWith('/api/')) {
      return handleApiRequest(req, res);
    }

    // Static Asset Requests
    let filePath = path.join(DASHBOARD_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Safety check to prevent directory traversal
    if (!filePath.startsWith(DASHBOARD_DIR)) {
      res.writeHead(403);
      return res.end('Access denied');
    }

    let contentType = 'text/html';
    const ext = path.extname(filePath);
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.json') contentType = 'application/json';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end(`Server error: ${err.code}`);
        }
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log('');
    console.log(c.brand('  ╭──────────────────────────────────────────────╮'));
    console.log(c.brand('  │') + c.brand('    ⚡ snip Dashboard running locally!       ') + c.brand('│'));
    console.log(c.brand('  ╰──────────────────────────────────────────────╯'));
    console.log('');
    console.log(`  Local URL:  ` + c.brand(url));
    console.log(c.dim(`  Press Ctrl+C to stop the dashboard server.`));
    console.log('');

    openBrowser(url);
  });

  // Keep process alive
  await new Promise((resolve) => {
    process.once('SIGINT', () => {
      console.log(c.dim('\n  Stopping dashboard server...'));
      server.close();
      setExitCode(0);
      resolve();
    });
  });
}

module.exports = dashboardCmd;
