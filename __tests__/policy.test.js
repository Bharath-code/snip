const fs = require('fs');
const path = require('path');
const os = require('os');

describe('policy.checkExec', () => {
  const policy = require('../lib/policy');

  const base = { deny: [], allow: [], allowedLanguages: null, execRequiresApproval: false, maxRuntimeMs: null };

  test('allows plain content with default policy', () => {
    const r = policy.checkExec('echo hello', 'sh', { ...base });
    expect(r.blocked).toBe(false);
    expect(r.requiresApproval).toBe(false);
  });

  test('built-in safety rules block regardless of policy', () => {
    const r = policy.checkExec('rm -rf /tmp/x', 'sh', { ...base, allow: ['.*'] });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/built-in/);
  });

  test('policy deny pattern blocks', () => {
    const r = policy.checkExec('kubectl delete pod x', 'sh', { ...base, deny: ['kubectl\\s+delete'] });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/deny pattern/);
  });

  test('language allowlist blocks other languages', () => {
    const r = policy.checkExec('print(1)', 'python', { ...base, allowedLanguages: ['sh', 'bash'] });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/allowedLanguages/);
  });

  test('allow list blocks non-matching content and passes matching', () => {
    const p = { ...base, allow: ['^npm\\s+'] };
    expect(policy.checkExec('npm run build', 'sh', p).blocked).toBe(false);
    expect(policy.checkExec('cargo build', 'sh', p).blocked).toBe(true);
  });

  test('propagates requiresApproval and maxRuntimeMs', () => {
    const r = policy.checkExec('echo ok', 'sh', { ...base, execRequiresApproval: true, maxRuntimeMs: 5000 });
    expect(r.blocked).toBe(false);
    expect(r.requiresApproval).toBe(true);
    expect(r.maxRuntimeMs).toBe(5000);
  });

  test('invalid regex in policy is skipped, not fatal', () => {
    const r = policy.checkExec('echo ok', 'sh', { ...base, deny: ['[invalid'] });
    expect(r.blocked).toBe(false);
  });
});

describe('policy.loadPolicy', () => {
  const policy = require('../lib/policy');
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-policy-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('returns defaults when no .snip dir exists', () => {
    const p = policy.loadPolicy(dir);
    expect(p.deny).toEqual([]);
    expect(p.execRequiresApproval).toBe(false);
    expect(p.source).toBeNull();
  });

  test('reads policy.json from .snip dir', () => {
    const snipDir = path.join(dir, '.snip');
    fs.mkdirSync(snipDir);
    fs.writeFileSync(path.join(snipDir, 'policy.json'), JSON.stringify({
      deny: ['terraform\\s+apply'],
      allowedLanguages: ['SH'],
      execRequiresApproval: true,
      maxRuntimeMs: 10000,
    }));

    const p = policy.loadPolicy(dir);
    expect(p.deny).toEqual(['terraform\\s+apply']);
    expect(p.allowedLanguages).toEqual(['sh']);
    expect(p.execRequiresApproval).toBe(true);
    expect(p.maxRuntimeMs).toBe(10000);
    expect(p.source).toContain('policy.json');
  });

  test('unparseable policy.json falls back to defaults', () => {
    const snipDir = path.join(dir, '.snip');
    fs.mkdirSync(snipDir);
    fs.writeFileSync(path.join(snipDir, 'policy.json'), '{ nope');
    const p = policy.loadPolicy(dir);
    expect(p.execRequiresApproval).toBe(false);
    expect(p.source).toBeNull();
  });
});

describe('audit log', () => {
  const audit = require('../lib/audit');

  test('append writes JSONL entries with ts and user', () => {
    audit.append({ tool: 'snip_exec', args: { name: 'x' }, isError: false });
    audit.append({ event: 'approval_executed', exitCode: 0 });

    const entries = audit.readAll();
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const last = entries[entries.length - 1];
    expect(last.event).toBe('approval_executed');
    expect(typeof last.ts).toBe('string');
    expect(typeof last.user).toBe('string');
  });
});

describe('approvals queue', () => {
  const approvals = require('../lib/approvals');

  test('create, get, list, remove round-trip', () => {
    const entry = approvals.create({ snippet: 'deploy', content: 'echo deploy', language: 'sh' });
    expect(entry.id).toMatch(/^[a-f0-9]{8}$/);

    expect(approvals.get(entry.id).snippet).toBe('deploy');
    expect(approvals.list().some(e => e.id === entry.id)).toBe(true);

    expect(approvals.remove(entry.id)).toBe(true);
    expect(approvals.get(entry.id)).toBeNull();
    expect(approvals.remove(entry.id)).toBe(false);
  });
});
