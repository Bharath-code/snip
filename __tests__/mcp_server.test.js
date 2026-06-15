const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

describe('MCP Server — Module', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-mcp-test-${Date.now()}`);
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
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('module loads without error (SDK imports deferred)', () => {
    expect(() => require('../lib/mcp-server')).not.toThrow();
  });

  test('exports start, createServer, and TOOLS', () => {
    const mcp = require('../lib/mcp-server');
    expect(typeof mcp.start).toBe('function');
    expect(typeof mcp.createServer).toBe('function');
    expect(Array.isArray(mcp.TOOLS)).toBe(true);
  });

  test('TOOLS array has all expected tools', () => {
    const mcp = require('../lib/mcp-server');
    const toolNames = mcp.TOOLS.map(t => t.name);
    expect(toolNames).toContain('snip_search');
    expect(toolNames).toContain('snip_list');
    expect(toolNames).toContain('snip_read');
    expect(toolNames).toContain('snip_save');
    expect(toolNames).toContain('snip_edit');
    expect(toolNames).toContain('snip_delete');
    expect(toolNames).toContain('snip_rename');
    expect(toolNames).toContain('snip_suggest');
    expect(toolNames).toContain('snip_exec');
    expect(toolNames).toContain('snip_history');
    expect(toolNames).toContain('snip_diff');
    expect(toolNames).toContain('snip_undo');
    expect(toolNames).toContain('snip_share');
    expect(toolNames).toContain('snip_discover');
    expect(toolNames).toContain('snip_unshare');
    expect(toolNames).toContain('snip_searchRelevance');
    expect(mcp.TOOLS.length).toBe(16);
  });

  test('each tool has name, description, and inputSchema', () => {
    const mcp = require('../lib/mcp-server');
    for (const tool of mcp.TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

describe('MCP Server — Storage Operations', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-mcp-storage-${Date.now()}`);
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
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('add, list, get, read, and search snippets', () => {
    const storage = require('../lib/storage');

    // Add test snippets
    storage.addSnippet({
      name: 'mcp-test-1',
      content: 'echo "hello mcp"',
      language: 'bash',
      tags: ['test', 'mcp'],
    });

    storage.addSnippet({
      name: 'mcp-test-2',
      content: 'docker ps',
      language: 'bash',
      tags: ['docker', 'test'],
    });

    // List should include both
    const all = storage.listSnippets();
    const names = all.map(s => s.name);
    expect(names).toContain('mcp-test-1');
    expect(names).toContain('mcp-test-2');

    // Get by name
    const s = storage.getSnippetByIdOrName('mcp-test-1');
    expect(s).toBeDefined();
    expect(s.name).toBe('mcp-test-1');

    // Read content
    const content = storage.readSnippetContent(s);
    expect(content).toBe('echo "hello mcp"');

    // Search
    const search = require('../lib/search');
    const results = search.search('mcp', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name === 'mcp-test-1')).toBe(true);
  });

  test('exec.resolveRunner works for bash', () => {
    const exec = require('../lib/exec');
    const runner = exec.resolveRunner('bash');
    expect(runner.command).toBe('bash');
    expect(runner.kind).toBe('shell');
  });

  test('safety.detection works', () => {
    const safety = require('../lib/safety');
    expect(safety.isDangerous('rm -rf /')).toBe(true);
    expect(safety.isDangerous('echo hello')).toBe(false);
    expect(safety.isDangerous('docker rm -f container')).toBe(true);
  });
});

describe('MCP Server — Protocol via stdio', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-mcp-proto-${Date.now()}`);
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
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch (_) {
        // Retry with shell rm -rf on ENOTEMPTY
        require('child_process').execSync(`rm -rf "${testDir}"`, { stdio: 'ignore' });
      }
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  function sendJsonRpc(proc, message) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(message) + '\n';
      const timeout = setTimeout(() => reject(new Error('Response timeout')), 10000);

      let responseData = '';
      const onData = (chunk) => {
        responseData += chunk.toString();
        try {
          const result = JSON.parse(responseData);
          clearTimeout(timeout);
          proc.stdout.removeListener('data', onData);
          resolve(result);
        } catch {
          // Incomplete JSON, keep buffering
        }
      };

      proc.stdout.on('data', onData);
      proc.stdin.write(data);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function waitForServer(proc) {
    return new Promise((resolve) => {
      // Wait for the server to start processing stdin
      setTimeout(resolve, 500);
    });
  }

  test('responds to ListTools request', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });

      expect(response).toBeDefined();
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);

      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('snip_search');
      expect(toolNames).toContain('snip_list');
      expect(toolNames).toContain('snip_read');
      expect(toolNames).toContain('snip_save');
      expect(toolNames).toContain('snip_edit');
      expect(toolNames).toContain('snip_delete');
      expect(toolNames).toContain('snip_rename');
      expect(toolNames).toContain('snip_suggest');
      expect(toolNames).toContain('snip_exec');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('responds to ListResources request', async () => {
    // Add a snippet via storage before spawning the server
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-resource-test',
      content: 'echo "resource test"',
      language: 'bash',
      tags: [],
    });
    // Force immediate save so the child process can read from disk
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {},
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeDefined();
      expect(response.result.resources.length).toBeGreaterThanOrEqual(1);

      const uris = response.result.resources.map(r => r.uri);
      expect(uris.some(u => u.includes('mcp-resource-test'))).toBe(true);
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_save tool call', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'snip_save',
          arguments: {
            name: 'mcp-save-test',
            content: 'kubectl get pods --all-namespaces',
            language: 'bash',
            tags: ['k8s', 'mcp'],
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      // Parse the response text to verify the saved snippet details
      const resultText = response.result.content[0].text;
      const saved = JSON.parse(resultText);
      expect(saved.name).toBe('mcp-save-test');
      expect(saved.tags).toContain('k8s');
      expect(saved.language).toBe('bash');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_edit tool call — updates content and tags', async () => {
    // Pre-save a snippet via storage
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-edit-test',
      content: 'echo "original"',
      language: 'bash',
      tags: ['original'],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'snip_edit',
          arguments: {
            name: 'mcp-edit-test',
            content: 'echo "updated"',
            tags: ['updated', 'mcp'],
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      const resultText = response.result.content[0].text;
      const edited = JSON.parse(resultText);
      expect(edited.name).toBe('mcp-edit-test');
      expect(edited.tags).toContain('updated');
      expect(edited.content).toContain('updated');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_delete tool call', async () => {
    // Pre-save a snippet via storage
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-delete-test',
      content: 'echo "to be deleted"',
      language: 'bash',
      tags: ['temp'],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'snip_delete',
          arguments: {
            name: 'mcp-delete-test',
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      const resultText = response.result.content[0].text;
      const deleted = JSON.parse(resultText);
      expect(deleted.deleted).toBe(true);
      expect(deleted.name).toBe('mcp-delete-test');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_rename tool call', async () => {
    // Pre-save a snippet via storage
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-old-name',
      content: 'echo "rename me"',
      language: 'bash',
      tags: [],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'snip_rename',
          arguments: {
            name: 'mcp-old-name',
            new_name: 'mcp-new-name',
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      const resultText = response.result.content[0].text;
      const renamed = JSON.parse(resultText);
      expect(renamed.renamed).toBe(true);
      expect(renamed.old_name).toBe('mcp-old-name');
      expect(renamed.new_name).toBe('mcp-new-name');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_share — errors without token', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'snip_share',
          arguments: {
            name: 'any-snippet',
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      // Should error because no SNIP_GIST_TOKEN is set
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('token not configured');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_share — errors for missing snippet (no API call)', async () => {
    // Pre-save a snippet to verify the server can read it
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-real-snippet',
      content: 'echo "real"',
      language: 'bash',
      tags: ['test'],
    });
    storage.flush();

    // Spawn with a fake token so token check passes, but request a non-existent snippet
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SNIP_GIST_TOKEN: 'ghp_test_fake_token_no_api_call',
      },
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'snip_share',
          arguments: {
            name: 'non-existent-snippet',
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('Snippet not found');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_share — errors with empty name', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SNIP_GIST_TOKEN: 'ghp_test_fake_token_no_api_call',
      },
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'snip_share',
          arguments: {},
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('No snippet name');
    } finally {
      proc.kill();
    }
  }, 15000);

  // ── snip_unshare E2E tests ──

  test('handles snip_unshare — errors without token', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'snip_unshare',
          arguments: { name: 'any-snippet' },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('token not configured');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_unshare — errors with empty name', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SNIP_GIST_TOKEN: 'ghp_test_fake_token_no_api',
      },
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'snip_unshare',
          arguments: {},
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('name is required');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_unshare — errors for missing snippet', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SNIP_GIST_TOKEN: 'ghp_test_fake_token_no_api',
      },
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'snip_unshare',
          arguments: { name: 'non-existent-snippet' },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('Snippet not found');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_unshare — errors for snippet with no shared Gist', async () => {
    // Pre-save a snippet with no origin.gistId (never shared)
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-local-only',
      content: 'echo "never shared"',
      language: 'bash',
      tags: [],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SNIP_GIST_TOKEN: 'ghp_test_fake_token_no_api',
      },
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'snip_unshare',
          arguments: { name: 'mcp-local-only' },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      // Snippet exists but has no origin.gistId → "has no shared Gist"
      expect(parsed.error).toContain('has no shared Gist');
    } finally {
      proc.kill();
    }
  }, 15000);

  // ── snip_discover E2E tests ──

  test('handles snip_discover — errors without query or recent', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'snip_discover',
          arguments: {},
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('No search query provided');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_discover — errors in search mode without token', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'snip_discover',
          arguments: { query: 'docker health' },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('token not configured');
      // Should also hint about recent mode as an alternative
      expect(parsed.hint).toContain('recent');
    } finally {
      proc.kill();
    }
  }, 15000);

  // ── snip_searchRelevance E2E tests ──

  test('handles snip_searchRelevance — returns error for empty query', async () => {
    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'snip_searchRelevance',
          arguments: {},
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.error).toContain('query is required');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_searchRelevance — returns results with scores', async () => {
    // Pre-save a snippet so search has content to match
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-sr-test',
      content: 'docker system prune -af --volumes',
      language: 'bash',
      tags: ['docker', 'cleanup'],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'snip_searchRelevance',
          arguments: { query: 'docker', limit: 5 },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      expect(parsed.query).toBe('docker');
      expect(parsed.total).toBeGreaterThanOrEqual(1);
      expect(parsed.results.length).toBeGreaterThanOrEqual(1);
      expect(parsed.results[0].name).toBe('mcp-sr-test');
      expect(typeof parsed.results[0].score).toBe('number');
      expect(parsed.results[0].score).toBeGreaterThanOrEqual(0);
      expect(parsed.results[0].score).toBeLessThanOrEqual(1);
      expect(parsed.results[0].language).toBe('bash');
    } finally {
      proc.kill();
    }
  }, 15000);

  test('handles snip_searchRelevance — min_score filter excludes low-relevance results', async () => {
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'mcp-sr-python',
      content: 'import os; print("hello")',
      language: 'python',
      tags: ['python'],
    });
    storage.flush();

    const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderrData = '';
    proc.stderr.on('data', (chunk) => { stderrData += chunk.toString(); });

    try {
      await waitForServer(proc);

      // Query for something that shouldn't match existing snippets well
      const response = await sendJsonRpc(proc, {
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'snip_searchRelevance',
          arguments: { query: 'docker', limit: 10, min_score: 0.01 },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBeFalsy();

      const resultText = response.result.content[0].text;
      const parsed = JSON.parse(resultText);
      // min_score 0.01 is very strict — all results should have score > 0.01
      // (perfect score 0 is unlikely with a fuzzy match)
      expect(parsed.total).toBe(0);
      expect(parsed.results.length).toBe(0);
    } finally {
      proc.kill();
    }
  }, 15000);
});
