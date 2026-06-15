const fs = require('fs');
const path = require('path');
const os = require('os');

describe('alias command', () => {
  let testDir;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-alias-test-${Date.now()}`);
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
    const alias = require('../lib/commands/alias');
    expect(typeof alias).toBe('function');
  });

  test('generates bash aliases for snippets', () => {
    const storage = require('../lib/storage');
    storage.addSnippet({ name: 'deploy-api', content: 'curl https://api.example.com/deploy', language: 'sh', tags: ['deploy'] });
    storage.addSnippet({ name: 'docker-cleanup', content: 'docker system prune -af', language: 'sh', tags: ['docker'] });

    const alias = require('../lib/commands/alias');
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    alias('bash');

    expect(spyLog).toHaveBeenCalled();
    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('deploy-api');
    expect(output).toContain("alias deploy-api='snip exec deploy-api'");
    expect(output).toContain("alias docker-cleanup='snip exec docker-cleanup'");

    spyLog.mockRestore();
    spyErr.mockRestore();
  });

  test('generates fish functions for snippets', () => {
    const alias = require('../lib/commands/alias');
    const storage = require('../lib/storage');
    storage.addSnippet({ name: 'deploy-api', content: 'curl deploy', language: 'sh', tags: [] });

    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    alias('fish');

    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('function deploy_api');
    expect(output).toContain('$argv');

    spyLog.mockRestore();
  });

  test('handles empty snippet library', () => {
    const alias = require('../lib/commands/alias');
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    alias('bash');

    expect(spyErr).toHaveBeenCalled();
    expect(spyErr.mock.calls[0][0]).toContain('No snippets');

    spyErr.mockRestore();
  });

  test('auto-detects shell from SHELL env', () => {
    const alias = require('../lib/commands/alias');
    const storage = require('../lib/storage');
    storage.addSnippet({ name: 'test-cmd', content: 'echo test', language: 'sh', tags: [] });

    process.env.SHELL = '/bin/zsh';

    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    alias(); // no shell argument — auto-detect

    const output = spyLog.mock.calls.map(c => c[0]).join('\n');
    // bash/zsh use alias syntax
    expect(output).toContain("alias test-cmd='snip exec test-cmd'");

    spyLog.mockRestore();
  });
});
