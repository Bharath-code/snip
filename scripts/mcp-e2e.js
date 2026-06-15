#!/usr/bin/env node

/**
 * snip MCP Server — End-to-End Test
 *
 * Uses a SINGLE server process for the full workflow:
 * save → search → read → list → edit → rename → delete → exec → resources
 *
 * Usage: node scripts/mcp-e2e.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Setup isolated environment ──

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-e2e-'));
const configDir = path.join(testDir, 'config');
const dataDir = path.join(testDir, 'data');
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const env = {
  ...process.env,
  XDG_CONFIG_HOME: configDir,
  XDG_DATA_HOME: dataDir,
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    fn();
    passed++;
    console.log('\x1b[32m\u2713\x1b[0m');
  } catch (err) {
    failed++;
    console.log('\x1b[31m\u2717\x1b[0m');
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    passed++;
    console.log('\x1b[32m\u2713\x1b[0m');
  } catch (err) {
    failed++;
    console.log('\x1b[31m\u2717\x1b[0m');
    console.error(`    ${err.message}`);
  }
}

// ── MCP Client Helpers ──

function spawnMcpServer() {
  const proc = spawn('node', [path.join(__dirname, '..', 'lib', 'mcp-server.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
  proc.stderr.on('data', () => {}); // drain
  return proc;
}

let msgId = 0;

function call(proc, method, params = {}, toolName) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const data = JSON.stringify({
      jsonrpc: '2.0', id, method,
      params: toolName ? { name: toolName, arguments: params } : params,
    }) + '\n';

    const timeout = setTimeout(() => reject(new Error(`Response timeout for ${method}`)), 10000);

    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      try {
        const result = JSON.parse(buf);
        clearTimeout(timeout);
        proc.stdout.removeListener('data', onData);
        resolve(result);
      } catch { /* keep buffering */ }
    };

    proc.stdout.on('data', onData);
    proc.stdin.write(data);
    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

// ── E2E Tests ──

async function run() {
  console.log('\n  \x1b[1m' + '\u2550'.repeat(50) + '\x1b[0m');
  console.log('  \x1b[1msnip MCP Server \u2014 End-to-End Test Suite\x1b[0m');
  console.log('  \x1b[1m' + '\u2550'.repeat(50) + '\x1b[0m\n');

  const proc = spawnMcpServer();
  await new Promise(r => setTimeout(r, 600));

  try {
    // ── 1. ListTools ──
    await testAsync('ListTools \u2014 returns all 8 tools', async () => {
      const res = await call(proc, 'tools/list');
      if (!res.result?.tools) throw new Error('No tools returned');
      const names = res.result.tools.map(t => t.name);
      const expected = ['snip_search', 'snip_list', 'snip_read', 'snip_save',
                        'snip_edit', 'snip_delete', 'snip_rename', 'snip_exec'];
      for (const n of expected) {
        if (!names.includes(n)) throw new Error(`Missing tool: ${n}`);
      }
      if (names.length !== 8) throw new Error(`Expected 8 tools, got ${names.length}`);
    });

    // ── 2. snip_save ──
    let savedId;
    await testAsync('snip_save \u2014 saves a new snippet', async () => {
      const res = await call(proc, 'tools/call', {
        name: 'e2e-health-check', content: 'curl -s http://localhost:8080/health | jq .',
        language: 'bash', tags: ['e2e', 'health'],
      }, 'snip_save');

      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const saved = JSON.parse(res.result.content[0].text);
      if (saved.name !== 'e2e-health-check') throw new Error(`Wrong name: ${saved.name}`);
      savedId = saved.id;
    });

    // ── 3. snip_save (second snippet) ──
    await testAsync('snip_save \u2014 saves a second snippet', async () => {
      const res = await call(proc, 'tools/call', {
        name: 'e2e-deploy', content: 'kubectl rollout status deploy/web',
        language: 'bash', tags: ['e2e', 'k8s'],
      }, 'snip_save');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
    });

    // ── 4. snip_search ──
    await testAsync('snip_search \u2014 finds by fuzzy query', async () => {
      const res = await call(proc, 'tools/call', { query: 'health', limit: 5 }, 'snip_search');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const results = JSON.parse(res.result.content[0].text);
      if (!Array.isArray(results) || results.length === 0) throw new Error('No search results');
      if (!results.some(r => r.name === 'e2e-health-check')) throw new Error('Did not find e2e-health-check');
    });

    // ── 5. snip_read ──
    await testAsync('snip_read \u2014 reads snippet by name', async () => {
      const res = await call(proc, 'tools/call', { name: 'e2e-health-check' }, 'snip_read');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const snip = JSON.parse(res.result.content[0].text);
      if (!snip.content || !snip.createdAt) throw new Error('Missing content or timestamps');
      if (snip.name !== 'e2e-health-check') throw new Error(`Wrong name: ${snip.name}`);
    });

    // ── 6. snip_list ──
    await testAsync('snip_list \u2014 filters by tag', async () => {
      const res = await call(proc, 'tools/call', { tag: 'e2e', limit: 10 }, 'snip_list');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const list = JSON.parse(res.result.content[0].text);
      if (list.length < 2) throw new Error(`Expected >= 2 snippets, got ${list.length}`);
      const names = list.map(s => s.name);
      if (!names.includes('e2e-health-check')) throw new Error('Missing e2e-health-check');
      if (!names.includes('e2e-deploy')) throw new Error('Missing e2e-deploy');
    });

    // ── 7. snip_edit ──
    await testAsync('snip_edit \u2014 updates content and tags', async () => {
      const res = await call(proc, 'tools/call', {
        name: 'e2e-health-check',
        content: 'curl -s http://localhost:9090/health | jq .status',
        tags: ['e2e', 'health', 'updated'],
      }, 'snip_edit');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const edited = JSON.parse(res.result.content[0].text);
      if (edited.name !== 'e2e-health-check') throw new Error(`Wrong name: ${edited.name}`);
      if (!edited.tags.includes('updated')) throw new Error('Tags not updated');
      if (!edited.content.includes('9090')) throw new Error('Content not updated');
    });

    // ── 8. snip_read (verify edit persisted) ──
    await testAsync('snip_read \u2014 verifies edit persisted', async () => {
      const res = await call(proc, 'tools/call', { name: 'e2e-health-check' }, 'snip_read');
      const snip = JSON.parse(res.result.content[0].text);
      if (!snip.content.includes('9090')) throw new Error('Edit did not persist');
      if (!snip.tags.includes('updated')) throw new Error('Tags did not persist');
    });

    // ── 9. snip_rename ──
    await testAsync('snip_rename \u2014 renames a snippet', async () => {
      const res = await call(proc, 'tools/call', {
        name: 'e2e-deploy', new_name: 'e2e-rollout',
      }, 'snip_rename');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const renamed = JSON.parse(res.result.content[0].text);
      if (renamed.renamed !== true) throw new Error('renamed !== true');
      if (renamed.old_name !== 'e2e-deploy') throw new Error(`Wrong old_name: ${renamed.old_name}`);
      if (renamed.new_name !== 'e2e-rollout') throw new Error(`Wrong new_name: ${renamed.new_name}`);
    });

    // ── 10. snip_list (verify rename) ──
    await testAsync('snip_list \u2014 verifies rename', async () => {
      const res = await call(proc, 'tools/call', { tag: 'k8s', limit: 10 }, 'snip_list');
      const list = JSON.parse(res.result.content[0].text);
      // old name should not exist, new name should
      if (list.some(s => s.name === 'e2e-deploy')) throw new Error('Old name still exists');
      if (!list.some(s => s.name === 'e2e-rollout')) throw new Error('New name not found');
    });

    // ── 11. snip_delete ──
    await testAsync('snip_delete \u2014 deletes a snippet', async () => {
      const res = await call(proc, 'tools/call', { name: 'e2e-rollout' }, 'snip_delete');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const deleted = JSON.parse(res.result.content[0].text);
      if (deleted.deleted !== true) throw new Error('deleted !== true');
      if (deleted.name !== 'e2e-rollout') throw new Error(`Wrong name: ${deleted.name}`);
    });

    // ── 12. snip_read (verify delete) ──
    await testAsync('snip_read \u2014 verifies delete (should 404)', async () => {
      const res = await call(proc, 'tools/call', { name: 'e2e-rollout' }, 'snip_read');
      if (!res.result?.isError) throw new Error('Should have errored (snippet deleted)');
      if (!res.result.content[0].text.includes('not found')) throw new Error('Wrong error message');
    });

    // ── 13. snip_exec (dry-run) ──
    await testAsync('snip_exec \u2014 dry-run shows content', async () => {
      const res = await call(proc, 'tools/call', {
        name: 'e2e-health-check', dry_run: true,
      }, 'snip_exec');
      if (res.result?.isError) throw new Error(res.result.content[0].text);
      const execRes = JSON.parse(res.result.content[0].text);
      if (execRes.dryRun !== true) throw new Error('Expected dryRun=true');
      if (!execRes.content) throw new Error('Missing content');
    });

    // ── 14. ListResources ──
    await testAsync('ListResources \u2014 returns snippets as resources', async () => {
      const res = await call(proc, 'resources/list');
      const resources = res.result?.resources;
      if (!Array.isArray(resources)) throw new Error('No resources array');
      const uris = resources.map(r => r.uri);
      if (!uris.some(u => u.includes('e2e-health-check'))) throw new Error('Missing e2e-health-check resource');
    });

    // ── 15. ReadResource ──
    await testAsync('ReadResource \u2014 reads snippet via resource URI', async () => {
      const res = await call(proc, 'resources/read', {
        uri: 'snip://snippets/e2e-health-check',
      });
      const contents = res.result?.contents;
      if (!contents || contents.length === 0) throw new Error('No contents');
      if (!contents[0].text) throw new Error('Empty content');
      if (contents[0].uri !== 'snip://snippets/e2e-health-check') throw new Error('Wrong URI');
    });

  } finally {
    proc.kill();
  }

  // ── Cleanup ──
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}

  // ── Results ──
  console.log('\n  \x1b[1m' + '\u2550'.repeat(50) + '\x1b[0m');
  console.log(`  Results: \x1b[32m${passed} passed\x1b[0m, ${failed} failed, ${passed + failed} total`);
  console.log('  \x1b[1m' + '\u2550'.repeat(50) + '\x1b[0m\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
