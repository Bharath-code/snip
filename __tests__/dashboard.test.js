const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

describe('Web Dashboard', () => {
  const originalEnv = process.env;
  let testDir;
  let dashboardPromise;
  let sigintHandler = null;
  const originalOnce = process.once;
  const PORT = 5678;

  beforeAll(async () => {
    // Set up temp config & data directories to isolate the test database
    testDir = path.join(os.tmpdir(), `snip-dashboard-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    process.env = {
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
    };

    jest.resetModules();

    // Mock child_process.exec to prevent actual browser pages from popping up
    const cp = require('child_process');
    jest.spyOn(cp, 'exec').mockImplementation((cmd, cb) => {
      if (cb) cb(null);
      return {};
    });

    // Capture the SIGINT handler to gracefully stop the http server
    process.once = function (event, handler) {
      if (event === 'SIGINT') {
        sigintHandler = handler;
      }
      return originalOnce.apply(this, arguments);
    };

    // Load and run the dashboard server on the custom port
    const dashboardCmd = require('../lib/commands/dashboard');
    dashboardPromise = dashboardCmd({ port: PORT });

    // Wait a brief period for the server to bind and start listening
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Stop the dashboard server by calling the captured SIGINT clean-up callback
    if (sigintHandler) {
      sigintHandler();
    }
    await dashboardPromise;

    // Restore process and environment variables
    process.once = originalOnce;
    process.env = originalEnv;

    // Clean up temporary workspace directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    jest.resetModules();
  });

  // Helper to construct request promises to the local server
  function request(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: urlPath,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
      }
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: res.headers['content-type']?.includes('application/json') ? JSON.parse(data) : data,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data,
            });
          }
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  test('GET /api/snippets returns empty array initially', async () => {
    const res = await request('GET', '/api/snippets');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  let createdSnippet = null;

  test('POST /api/snippets creates a new snippet', async () => {
    const payload = {
      name: 'test-snippet',
      content: 'echo "hello web dashboard"',
      language: 'sh',
      tags: ['web', 'test']
    };
    const res = await request('POST', '/api/snippets', payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('test-snippet');
    expect(res.body.language).toBe('sh');
    expect(res.body.tags).toEqual(['web', 'test']);
    expect(res.body.id).toBeDefined();
    createdSnippet = res.body;
  });

  test('GET /api/snippets/:id returns details with content', async () => {
    expect(createdSnippet).not.toBeNull();
    const res = await request('GET', `/api/snippets/${createdSnippet.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('test-snippet');
    expect(res.body.content).toBe('echo "hello web dashboard"');
  });

  test('PUT /api/snippets/:id updates snippet content and metadata', async () => {
    expect(createdSnippet).not.toBeNull();
    const payload = {
      name: 'test-snippet-updated',
      content: 'echo "hello updated web dashboard"',
      language: 'bash',
      tags: ['web', 'test', 'updated']
    };
    const res = await request('PUT', `/api/snippets/${createdSnippet.id}`, payload);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('test-snippet-updated');
    expect(res.body.language).toBe('bash');
    expect(res.body.tags).toEqual(['web', 'test', 'updated']);

    // verify the updated content persists
    const getRes = await request('GET', `/api/snippets/${createdSnippet.id}`);
    expect(getRes.body.content).toBe('echo "hello updated web dashboard"');
  });

  test('POST /api/snippets/:id/run executes snippet locally and returns the exit status + output logs', async () => {
    expect(createdSnippet).not.toBeNull();
    const res = await request('POST', `/api/snippets/${createdSnippet.id}/run`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(0);
    expect(res.body.output).toContain('hello updated web dashboard');
    expect(res.body.error).toBeNull();
  });

  test('GET / index.html loads correctly', async () => {
    const res = await request('GET', '/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('snip — Web Dashboard');
  });

  test('GET /index.css loads correctly', async () => {
    const res = await request('GET', '/index.css');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
  });

  test('GET /../package.json returns 403 Access Denied (directory traversal block)', async () => {
    const res = await request('GET', '/../package.json');
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('Access denied');
  });

  test('DELETE /api/snippets/:id deletes the snippet', async () => {
    expect(createdSnippet).not.toBeNull();
    const res = await request('DELETE', `/api/snippets/${createdSnippet.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify requesting it returns a 404
    const getRes = await request('GET', `/api/snippets/${createdSnippet.id}`);
    expect(getRes.statusCode).toBe(404);
  });
});
