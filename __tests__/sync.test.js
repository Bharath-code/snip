const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the gist module to avoid actual network calls
jest.mock('../lib/sync/gist', () => ({
  pushSnippet: jest.fn().mockResolvedValue({ id: 'fake-gist-id', html_url: 'https://gist.github.com/fake' }),
  pullGist: jest.fn().mockResolvedValue([{ name: 'imported', content: 'echo imported' }]),
}));

describe('sync command', () => {
  let testDir;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-sync-test-${Date.now()}`);
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
    const sync = require('../lib/commands/sync');
    expect(typeof sync).toBe('function');
  });

  test('errors on push without id', async () => {
    const sync = require('../lib/commands/sync');
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await sync('push', null);

    expect(spyErr).toHaveBeenCalled();
    const errorMsg = spyErr.mock.calls.map(c => c[0]).join(' ');
    expect(errorMsg).toContain('Usage');

    spyErr.mockRestore();
    spyWarn.mockRestore();
  });

  test('errors on push without token', async () => {
    const sync = require('../lib/commands/sync');
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    await sync('push', 'test-snippet');

    expect(spyErr).toHaveBeenCalled();
    const errorMsg = spyErr.mock.calls.map(c => c[0]).join(' ');
    expect(errorMsg).toContain('token');

    spyErr.mockRestore();
  });

  test('errors on pull without id', async () => {
    const sync = require('../lib/commands/sync');
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    await sync('pull', null);

    expect(spyErr).toHaveBeenCalled();
    const errorMsg = spyErr.mock.calls.map(c => c[0]).join(' ');
    expect(errorMsg).toContain('Usage');

    spyErr.mockRestore();
  });

  test('errors on unknown action', async () => {
    const sync = require('../lib/commands/sync');
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    await sync('unknown-action', null);

    expect(spyErr).toHaveBeenCalled();
    const errorMsg = spyErr.mock.calls.map(c => c[0]).join(' ');
    expect(errorMsg).toContain('Unknown action');

    spyErr.mockRestore();
  });

  test('pull with gist id and valid token imports snippets', async () => {
    const storage = require('../lib/storage');
    process.env.SNIP_GIST_TOKEN = 'test-token';
    jest.resetModules();

    const sync = require('../lib/commands/sync');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await sync('pull', 'test-gist-id');

    expect(spyLog).toHaveBeenCalled();
    // Should have logged imported count
    const output = spyLog.mock.calls.map(c => c[0]).join(' ');
    expect(output).toContain('Imported');

    spyLog.mockRestore();
    spyErr.mockRestore();
    spyWarn.mockRestore();
  });
});
