const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock process.stdin.isTTY for pipe tests
const mockStdin = {
  isTTY: true,
  on: jest.fn(),
  setEncoding: jest.fn(),
};

describe('add command', () => {
  let testDir;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-add-test-${Date.now()}`);
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
    const add = require('../lib/commands/add');
    expect(typeof add).toBe('function');
  });

  test('adds a snippet with piped content', async () => {
    // Mock stdin to not be a TTY (pipe mode)
    const origIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    const origStdinOn = process.stdin.on;

    const chunks = [];
    process.stdin.on = (event, cb) => {
      if (event === 'data') {
        chunks.push('echo "hello world"');
        cb('echo "hello world"');
      }
      if (event === 'end') setTimeout(cb, 10);
      if (event === 'error') {}
      return process.stdin;
    };
    process.stdin.setEncoding = jest.fn();

    const storage = require('../lib/storage');
    const add = require('../lib/commands/add');

    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await add('hello-test', { lang: 'sh', tags: 'demo,test' });

    // Check the snippet was created
    const snippets = storage.listSnippets();
    const found = snippets.find(s => s.name === 'hello-test');
    expect(found).toBeTruthy();
    expect(found.language).toBe('sh');

    spyLog.mockRestore();
    process.stdin.isTTY = origIsTTY;
    process.stdin.on = origStdinOn;
    jest.resetModules();
  });

  test('errors on invalid name via storage', () => {
    const storage = require('../lib/storage');
    expect(() => {
      storage.addSnippet({ name: '', content: 'test', language: 'sh', tags: [] });
    }).toThrow('Invalid snippet name');
  });

  test('sanitizes snippet names with special characters', () => {
    const storage = require('../lib/storage');
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const s = storage.addSnippet({ name: 'bad name!@#', content: 'echo test', language: 'sh', tags: [] });
    expect(s.name).toBe('bad_name___'); // sanitized
    spyWarn.mockRestore();
  });
});
