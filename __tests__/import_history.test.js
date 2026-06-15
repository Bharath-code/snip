const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Import History — Auto-Capture', () => {
  const originalEnv = process.env;
  let testDir;
  let historyFile;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-hist-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    // Create a fake shell history file
    historyFile = path.join(testDir, '.zsh_history');
    const historyLines = [
      ': 1700000000:0;ls -la',
      ': 1700000001:0;cd projects',
      ': 1700000002:0;docker compose up -d',
      ': 1700000003:0;npm test',
      ': 1700000004:0;git status',
      ': 1700000005:0;docker compose up -d',
      ': 1700000006:0;npm test',
      ': 1700000007:0;docker compose up -d',
      ': 1700000008:0;git log --oneline',
      ': 1700000009:0;npm test',
      ': 1700000010:0;kubectl get pods -n staging',
      ': 1700000011:0;kubectl get pods -n staging',
      ': 1700000012:0;kubectl get pods -n staging',
      ': 1700000013:0;curl -X POST https://api.example.com/deploy',
      ': 1700000014:0;curl -X POST https://api.example.com/deploy',
      '',
    ];
    fs.writeFileSync(historyFile, historyLines.join('\n'), 'utf8');

    process.env = {
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
      HISTFILE: historyFile,
      SHELL: '/bin/zsh',
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

  test('should list commands run 3+ times from history', () => {
    const importHistory = require('../lib/commands/import-history');
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    importHistory({ last: 100, minCount: 3 });

    spyLog.mockRestore();

    const output = logs.join('\n');
    // docker compose up -d appears 3 times → name: docker-compose
    expect(output).toContain('docker-compose');
    // npm test appears 3 times
    expect(output).toContain('npm-test');
    // kubectl get pods -n staging appears 3 times → name: kubectl-get-pods-staging
    expect(output).toContain('kubectl-get-pods-staging');
  });

  test('should not include commands below min count', () => {
    const importHistory = require('../lib/commands/import-history');
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    importHistory({ last: 100, minCount: 5 });

    spyLog.mockRestore();

    const output = logs.join('\n');
    // No command appears 5+ times
    expect(output).toContain('No new commands found');
  });

  test('should deduplicate against existing snippets', () => {
    const storage = require('../lib/storage');
    const importHistory = require('../lib/commands/import-history');

    // Pre-save a snippet that matches one of the history commands
    storage.addSnippet({
      name: 'docker-compose-up',
      content: 'docker compose up -d',
      language: 'bash',
      tags: ['from-history'],
    });

    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    importHistory({ last: 100, minCount: 3 });

    spyLog.mockRestore();

    const output = logs.join('\n');
    // docker-compose-up should be filtered out since it already exists
    expect(output).not.toContain('docker-compose-up');
    // But other commands should still appear
    expect(output).toContain('npm-test');
    expect(output).toContain('kubectl-get-pods');
  });

  test('should show interactive prompt in --interactive mode', async () => {
    // Mock readline.question to auto-accept with 'n' (skip all)
    const mockQuestion = jest.fn().mockResolvedValue('n');
    jest.doMock('../lib/readline', () => ({
      question: mockQuestion,
    }));

    const importHistory = require('../lib/commands/import-history');
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    await importHistory({ last: 100, minCount: 3, interactive: true });

    spyLog.mockRestore();
    jest.dontMock('../lib/readline');

    const output = logs.join('\n');
    // The prompt goes to stdout via readline (not console.log), but we see Skipped. 
    // which means our mock returned 'n' and the code ran the else branch
    expect(output).toContain('Skipped');
    expect(mockQuestion).toHaveBeenCalled();
  });

  test('should auto-save snippets in --auto mode', () => {
    const storage = require('../lib/storage');
    const importHistory = require('../lib/commands/import-history');
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    importHistory({ last: 100, minCount: 3, auto: true });

    spyLog.mockRestore();

    const output = logs.join('\n');
    expect(output).toContain('Auto-saving');
    expect(output).toContain('Saved');

    // Verify snippets were actually saved
    const snippets = storage.listSnippets();
    const names = snippets.map(s => s.name);
    expect(names).toContain('docker-compose');
    expect(names).toContain('npm-test');
    expect(names).toContain('kubectl-get-pods-staging');
  });

  test('should output JSON with --json flag', () => {
    const importHistory = require('../lib/commands/import-history');
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    importHistory({ last: 100, minCount: 3, json: true });

    spyLog.mockRestore();

    const output = logs.join('\n');
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('command');
    expect(data[0]).toHaveProperty('count');
    expect(data[0]).toHaveProperty('suggestedName');
    expect(data[0]).toHaveProperty('language');
  });
});

describe('Import History — Name Generation', () => {
  test('should generate kebab-case names from commands', () => {
    const { generateName } = require('../lib/commands/import-history');

    expect(generateName('docker compose up -d')).toBe('docker-compose');
    expect(generateName('kubectl get pods -n staging')).toBe('kubectl-get-pods-staging');
    expect(generateName('npm test')).toBe('npm-test');
    expect(generateName('git log --oneline -5')).toBe('git-log-oneline');
    expect(generateName('curl -X POST https://api.example.com/deploy')).toBe('curl-post');
    expect(generateName('ssh deploy@prod.example.com')).toBe('ssh');
    expect(generateName('ls -la')).toBe('ls-la');
  });

  test('should handle edge cases in name generation', () => {
    const { generateName } = require('../lib/commands/import-history');
    expect(generateName('cd')).toBe('cd');
    expect(generateName('')).toBe('cmd');
  });
});

describe('Import History — Language Detection', () => {
  test('should detect common command languages', () => {
    const { detectLanguage } = require('../lib/commands/import-history');

    expect(detectLanguage('docker compose up -d')).toBe('bash');
    expect(detectLanguage('kubectl get pods')).toBe('bash');
    expect(detectLanguage('git status')).toBe('bash');
    expect(detectLanguage('npm install')).toBe('bash');
    expect(detectLanguage('node server.js')).toBe('js');
    expect(detectLanguage('python3 script.py')).toBe('python');
    expect(detectLanguage('cargo build')).toBe('rust');
    expect(detectLanguage('terraform apply')).toBe('bash');
  });

  test('should default to sh for unknown commands', () => {
    const { detectLanguage } = require('../lib/commands/import-history');
    expect(detectLanguage('some-custom-tool --flag')).toBe('sh');
  });
});
