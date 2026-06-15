const fs = require('fs');
const path = require('path');
const os = require('os');

describe('stats command', () => {
  let testDir;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-stats-test-${Date.now()}`);
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

  test('module exports a function', () => {
    const stats = require('../lib/commands/stats');
    expect(typeof stats).toBe('function');
  });

  test('shows stats for empty library', () => {
    const stats = require('../lib/commands/stats');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    stats({});

    expect(spyLog).toHaveBeenCalled();
    // Should contain some output
    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('snip');

    spyLog.mockRestore();
  });

  test('shows stats for library with snippets', () => {
    const storage = require('../lib/storage');
    storage.addSnippet({ name: 'cmd1', content: 'echo hello', language: 'sh', tags: ['demo'] });
    storage.addSnippet({ name: 'cmd2', content: 'docker ps', language: 'sh', tags: ['docker'] });
    storage.addSnippet({ name: 'script1', content: 'print("hi")', language: 'python', tags: ['demo', 'python'] });

    const stats = require('../lib/commands/stats');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    stats({});

    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('3'); // 3 snippets

    spyLog.mockRestore();
  });

  test('JSON output includes statistics', () => {
    const storage = require('../lib/storage');
    storage.addSnippet({ name: 'test', content: 'echo test', language: 'sh', tags: ['test'] });

    const stats = require('../lib/commands/stats');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    stats({ json: true });

    expect(spyLog).toHaveBeenCalled();
    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('total');
    expect(parsed).toHaveProperty('languages');
    expect(parsed).toHaveProperty('streak');
    expect(parsed.total).toBe(1);

    spyLog.mockRestore();
  });

  test('streak mode returns streak data', () => {
    const stats = require('../lib/commands/stats');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    stats({ streak: true });

    expect(spyLog).toHaveBeenCalled();
    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('streak');

    spyLog.mockRestore();
  });

  test('JSON streak mode returns JSON', () => {
    const stats = require('../lib/commands/stats');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    stats({ streak: true, json: true });

    expect(spyLog).toHaveBeenCalled();
    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('streak');
    expect(parsed).toHaveProperty('lastDate');

    spyLog.mockRestore();
  });
});
