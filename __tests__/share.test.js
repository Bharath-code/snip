const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the Gist module
const mockShareSnippet = jest.fn();
const mockSharePack = jest.fn();
const mockDeleteGist = jest.fn();
jest.mock('../lib/sync/gist', () => ({
  shareSnippet: mockShareSnippet,
  sharePack: mockSharePack,
  deleteGist: mockDeleteGist,
  pushSnippet: jest.fn(),
  pullGist: jest.fn(),
}));

describe('Share Command', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-share-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    process.env = {
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
      SNIP_GIST_TOKEN: 'test-token',
    };

    jest.resetModules();
    mockShareSnippet.mockReset();
    mockSharePack.mockReset();

    // Seed a test snippet
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'test-snippet',
      content: 'echo hello',
      language: 'sh',
      tags: ['test'],
    });
    storage.addSnippet({
      name: 'test-snippet-2',
      content: 'echo world',
      language: 'sh',
      tags: ['test'],
    });

    // Default mock returns
    mockShareSnippet.mockResolvedValue({
      id: 'gist-123',
      html_url: 'https://gist.github.com/user/gist-123',
      description: 'snip: test-snippet',
      files: { 'test_snippet.sh': { content: 'echo hello' } },
    });
    mockSharePack.mockResolvedValue({
      id: 'gist-pack-456',
      html_url: 'https://gist.github.com/user/gist-pack-456',
      description: 'snip pack: test-snippet, test-snippet-2',
      files: {
        'test_snippet.sh': { content: 'echo hello' },
        'test_snippet_2.sh': { content: 'echo world' },
      },
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('share single snippet', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await shareCmd('test-snippet', {});

    spyLog.mockRestore();
    spyError.mockRestore();

    expect(mockShareSnippet).toHaveBeenCalledWith('test-snippet', 'test-token');
    expect(logs.some(l => l.includes('Published'))).toBe(true);
  });

  test('share single snippet with --json', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const outputs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      outputs.push(args.join(' '));
    });
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await shareCmd('test-snippet', { json: true });

    spyLog.mockRestore();
    spyError.mockRestore();

    expect(mockShareSnippet).toHaveBeenCalledWith('test-snippet', 'test-token');
    // Should have JSON output
    const jsonOutput = outputs.find(o => o.includes('gistId'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.gistId).toBe('gist-123');
    expect(parsed.public).toBe(true);
  });

  test('share multiple snippets as pack', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await shareCmd(['test-snippet', 'test-snippet-2'], {});

    spyLog.mockRestore();
    spyError.mockRestore();

    expect(mockSharePack).toHaveBeenCalledWith(
      ['test-snippet', 'test-snippet-2'],
      'test-token'
    );
    expect(logs.some(l => l.includes('2 snippets'))).toBe(true);
  });

  test('requires GitHub token', async () => {
    delete process.env.SNIP_GIST_TOKEN;
    jest.resetModules();

    const { shareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await shareCmd('test-snippet', {});

    spyError.mockRestore();
    spyLog.mockRestore();

    expect(errors.some(e => e.includes('not configured'))).toBe(true);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  test('requires at least one snippet name', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    await shareCmd([], {});

    spyError.mockRestore();

    expect(errors.some(e => e.includes('At least one'))).toBe(true);
    expect(process.exitCode).toBe(2);
    process.exitCode = 0;
  });

  test('handles missing snippets', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    await shareCmd(['nonexistent'], {});

    spyError.mockRestore();

    // Should fail before calling sharePack
    expect(mockShareSnippet).not.toHaveBeenCalled();
    expect(mockSharePack).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  test('share with --copy flag', async () => {
    const { shareCmd } = require('../lib/commands/share');

    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    await shareCmd('test-snippet', { copy: true });

    spyLog.mockRestore();

    // Should have attempted clipboard copy
    expect(mockShareSnippet).toHaveBeenCalled();
  });
});

describe('Unshare Command', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-unshare-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    process.env = {
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
      SNIP_GIST_TOKEN: 'test-token',
    };

    jest.resetModules();
    mockDeleteGist.mockReset();
    mockDeleteGist.mockResolvedValue(true);

    // Seed a test snippet WITH a gist origin (simulating a previously shared snippet)
    const storage = require('../lib/storage');
    const s = storage.addSnippet({
      name: 'shared-snippet',
      content: 'echo shared',
      language: 'sh',
      tags: ['shared'],
    });
    storage.setSnippetOrigin(s.id, { gistId: 'gist-shared-789' });

    // Seed another without origin
    storage.addSnippet({
      name: 'local-snippet',
      content: 'echo local',
      language: 'sh',
      tags: ['local'],
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('unshare a previously shared snippet', async () => {
    const { unshareCmd } = require('../lib/commands/share');

    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await unshareCmd('shared-snippet', {});

    spyLog.mockRestore();
    spyError.mockRestore();

    expect(mockDeleteGist).toHaveBeenCalledWith('gist-shared-789', 'test-token');
    expect(logs.some(l => l.includes('Unpublished'))).toBe(true);
  });

  test('unshare with --json output', async () => {
    const { unshareCmd } = require('../lib/commands/share');

    const outputs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      outputs.push(args.join(' '));
    });
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await unshareCmd('shared-snippet', { json: true });

    spyLog.mockRestore();
    spyError.mockRestore();

    expect(mockDeleteGist).toHaveBeenCalled();
    const jsonOutput = outputs.find(o => o.includes('gistId'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.unpublished).toBe(true);
    expect(parsed.snippet).toBe('shared-snippet');
  });

  test('requires GitHub token', async () => {
    delete process.env.SNIP_GIST_TOKEN;
    jest.resetModules();

    const { unshareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unshareCmd('shared-snippet', {});

    spyError.mockRestore();
    spyLog.mockRestore();

    expect(errors.some(e => e.includes('not configured'))).toBe(true);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  test('rejects missing snippet', async () => {
    const { unshareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    await unshareCmd('nonexistent', {});

    spyError.mockRestore();

    expect(mockDeleteGist).not.toHaveBeenCalled();
    expect(errors.some(e => e.includes('not found'))).toBe(true);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  test('rejects snippet without shared gist origin', async () => {
    const { unshareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unshareCmd('local-snippet', {});

    spyError.mockRestore();
    spyLog.mockRestore();

    expect(mockDeleteGist).not.toHaveBeenCalled();
    expect(errors.some(e => e.includes('no shared Gist'))).toBe(true);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  test('rejects missing name', async () => {
    const { unshareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    await unshareCmd(null, {});

    spyError.mockRestore();

    expect(errors.some(e => e.includes('is required'))).toBe(true);
    expect(process.exitCode).toBe(2);
    process.exitCode = 0;
  });

  test('handles API errors gracefully', async () => {
    mockDeleteGist.mockRejectedValue(new Error('Gist not found: gist-shared-789'));

    const { unshareCmd } = require('../lib/commands/share');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unshareCmd('shared-snippet', {});

    spyError.mockRestore();
    spyLog.mockRestore();

    expect(errors.some(e => e.includes('failed'))).toBe(true);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
