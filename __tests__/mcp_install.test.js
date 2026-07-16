const fs = require('fs');
const os = require('os');
const path = require('path');
const { mergeJsonConfig } = require('../lib/commands/mcp-install');

describe('mcp install config merge', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-mcp-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('creates config with snip server', () => {
    const p = path.join(dir, 'mcp.json');
    const res = mergeJsonConfig(p);
    expect(res.changed).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(cfg.mcpServers.snip).toEqual({ command: 'snip', args: ['mcp'] });
  });

  test('preserves existing servers and is idempotent', () => {
    const p = path.join(dir, 'mcp.json');
    fs.writeFileSync(p, JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
    mergeJsonConfig(p);
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(cfg.mcpServers.other).toEqual({ command: 'x' });
    expect(mergeJsonConfig(p).changed).toBe(false);
  });

  test('invalid JSON throws with manual instructions', () => {
    const p = path.join(dir, 'mcp.json');
    fs.writeFileSync(p, '{not json');
    expect(() => mergeJsonConfig(p)).toThrow(/not valid JSON/);
  });
});
