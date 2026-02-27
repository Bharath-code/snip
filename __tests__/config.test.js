const os = require('os');
const fs = require('fs');
const path = require('path');

// Isolate from real config
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-cfg-test-'));
process.env.XDG_CONFIG_HOME = path.join(tmpDir, '.config');
process.env.XDG_DATA_HOME = path.join(tmpDir, '.local', 'share');

const cfg = require('../lib/config');
const cfgCmd = require('../lib/commands/config');

afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
});

function captureLogs(fn) {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((msg) => logs.push(String(msg)));
    try { fn(); } finally { spy.mockRestore(); }
    return logs;
}

function captureErrors(fn) {
    const errs = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((msg) => errs.push(String(msg)));
    try { fn(); } finally { spy.mockRestore(); }
    return errs;
}

describe('config command', () => {
    test('config get (no key) returns full config JSON', () => {
        const logs = captureLogs(() => cfgCmd('get'));
        expect(logs.length).toBe(1);
        const parsed = JSON.parse(logs[0]);
        expect(parsed).toHaveProperty('editor');
        expect(parsed).toHaveProperty('confirmRun');
    });

    test('config get <key> returns value', () => {
        const logs = captureLogs(() => cfgCmd('get', 'confirmRun'));
        expect(logs[0]).toBe('true');
    });

    test('config set <key> <value> persists', () => {
        const logs = captureLogs(() => cfgCmd('set', 'editor', 'nano'));
        expect(logs[0]).toBe('OK');

        // Read back
        const logs2 = captureLogs(() => cfgCmd('get', 'editor'));
        expect(logs2[0]).toBe('nano');
    });

    test('config set without key shows error', () => {
        process.exitCode = 0;
        const errs = captureErrors(() => cfgCmd('set'));
        expect(errs[0]).toContain('Key required');
        expect(process.exitCode).toBe(1);
        process.exitCode = 0;
    });

    test('unknown action shows error', () => {
        process.exitCode = 0;
        const errs = captureErrors(() => cfgCmd('delete'));
        expect(errs[0]).toContain('Unknown action');
        expect(process.exitCode).toBe(1);
        process.exitCode = 0;
    });

    test('config set gist_token warns about sensitive key', () => {
        const warns = [];
        const spy = jest.spyOn(console, 'warn').mockImplementation((msg) => warns.push(String(msg)));
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        try {
            cfgCmd('set', 'gist_token', 'test-token-123');
        } finally {
            spy.mockRestore();
            logSpy.mockRestore();
        }
        expect(warns.some(w => w.includes('gist_token'))).toBe(true);
    });
});
