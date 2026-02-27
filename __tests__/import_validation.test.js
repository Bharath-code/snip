const os = require('os');
const fs = require('fs');
const path = require('path');

// Isolate from real data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-import-test-'));
process.env.XDG_CONFIG_HOME = path.join(tmpDir, '.config');
process.env.XDG_DATA_HOME = path.join(tmpDir, '.local', 'share');

const importCmd = require('../lib/commands/import');
const storage = require('../lib/storage');

afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
});

function writeFile(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content);
    return p;
}

function captureErrors(fn) {
    const errs = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((msg) => errs.push(String(msg)));
    try { fn(); } finally { spy.mockRestore(); }
    return errs;
}

function captureLogs(fn) {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((msg) => logs.push(String(msg)));
    try { fn(); } finally { spy.mockRestore(); }
    return logs;
}

describe('import validation', () => {
    beforeEach(() => { process.exitCode = 0; });

    test('rejects non-JSON content', () => {
        const f = writeFile('bad.json', 'not json at all');
        const errs = captureErrors(() => importCmd(f));
        expect(errs[0]).toContain('invalid JSON');
        expect(process.exitCode).toBe(1);
    });

    test('rejects non-array/non-object payload', () => {
        const f = writeFile('string.json', '"just a string"');
        const errs = captureErrors(() => importCmd(f));
        expect(errs[0]).toContain('array of snippets');
        expect(process.exitCode).toBe(1);
    });

    test('rejects number payload', () => {
        const f = writeFile('number.json', '42');
        const errs = captureErrors(() => importCmd(f));
        expect(errs[0]).toContain('array of snippets');
        expect(process.exitCode).toBe(1);
    });

    test('rejects empty array', () => {
        const f = writeFile('empty.json', '[]');
        const errs = captureErrors(() => importCmd(f));
        expect(errs[0]).toContain('no snippets found');
        expect(process.exitCode).toBe(1);
    });

    test('skips entries with invalid shape', () => {
        const data = [
            { name: 'valid', content: 'echo hi' },
            'not an object',
            { name: 123, content: 'bad name type' },
            { name: 'also-valid', content: 'echo bye' }
        ];
        const f = writeFile('mixed.json', JSON.stringify(data));
        const logs = captureLogs(() => importCmd(f));
        expect(logs[0]).toContain('2');
        expect(logs[0]).toContain('skipped');
    });

    test('accepts valid { snippets: [...] } wrapper', () => {
        const data = { snippets: [{ name: 'wrapper-test', content: 'echo wrapped', language: 'sh', tags: ['test'] }] };
        const f = writeFile('wrapped.json', JSON.stringify(data));
        const logs = captureLogs(() => importCmd(f));
        expect(logs[0]).toContain('1');
    });

    test('accepts valid flat array', () => {
        const data = [{ name: 'flat-test', content: 'echo flat' }];
        const f = writeFile('flat.json', JSON.stringify(data));
        const logs = captureLogs(() => importCmd(f));
        expect(logs[0]).toContain('1');
    });
});
