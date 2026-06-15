const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock storage before requiring versions
jest.mock('../lib/storage', () => {
  const snippets = {};
  let nextId = 1;
  return {
    getSnippetByIdOrName: jest.fn((idOrName) => {
      const s = snippets[idOrName] || Object.values(snippets).find(x => x.name === idOrName);
      return s || null;
    }),
    readSnippetContent: jest.fn((s) => {
      return s._content || '';
    }),
    updateSnippetContent: jest.fn((id, content) => {
      if (snippets[id]) snippets[id]._content = content;
    }),
    addSnippet: jest.fn(({ name, content }) => {
      const id = String(nextId++);
      snippets[id] = { id, name, _content: content };
      snippets[name] = snippets[id];
      return snippets[id];
    }),
    _reset() {
      Object.keys(snippets).forEach(k => delete snippets[k]);
      nextId = 1;
    },
    _addMock(name, content) {
      const id = String(nextId++);
      snippets[id] = { id, name, _content: content };
      snippets[name] = snippets[id];
      return snippets[id];
    }
  };
});

describe('versions module', () => {
  let testDir;

  beforeEach(() => {
    // Use unique dir per test to avoid cross-contamination
    // config.js evaluates APP_DIR at module load time, so resetModules + unique dir is needed
    testDir = path.join(os.tmpdir(), `snip-versions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = configDir;
    process.env.XDG_DATA_HOME = dataDir;
    jest.resetModules();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function freshVersions() {
    return require('../lib/versions');
  }

  function freshStorage() {
    return require('../lib/storage');
  }

  test('should save and list versions', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    storage._addMock('test-snippet', 'echo hello');

    const result = versions.saveVersion('test-snippet', 'Initial version');
    expect(result.version).toBe(1);

    const result2 = versions.saveVersion('test-snippet', 'Second version');
    expect(result2.version).toBe(2);

    const list = versions.listVersions('test-snippet');
    expect(list).toHaveLength(2);
    expect(list[0].version).toBe(1);
    expect(list[0].message).toBe('Initial version');
    expect(list[1].version).toBe(2);
    expect(list[1].message).toBe('Second version');
  });

  test('should get version content', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    const s = storage._addMock('test-snippet', 'echo hello');

    versions.saveVersion('test-snippet', 'v1');
    s._content = 'echo world';
    versions.saveVersion('test-snippet', 'v2');

    const content1 = versions.getVersionContent('test-snippet', 1);
    expect(content1).toBe('echo hello');

    const content2 = versions.getVersionContent('test-snippet', 2);
    expect(content2).toBe('echo world');
  });

  test('should return empty list for unknown snippet', () => {
    const versions = freshVersions();
    const list = versions.listVersions('nonexistent');
    expect(list).toEqual([]);
  });

  test('should handle non-existent version', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    storage._addMock('test-snippet', 'echo hello');
    versions.saveVersion('test-snippet', 'v1');

    const content = versions.getVersionContent('test-snippet', 999);
    expect(content).toBeNull();
  });

  test('should get latest version number', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    storage._addMock('test-snippet', 'echo hello');

    expect(versions.getLatestVersion('test-snippet')).toBe(0);

    versions.saveVersion('test-snippet', 'v1');
    versions.saveVersion('test-snippet', 'v2');
    versions.saveVersion('test-snippet', 'v3');

    expect(versions.getLatestVersion('test-snippet')).toBe(3);
  });

  test('should undo to previous version', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    const s = storage._addMock('test-snippet', 'v1 content');

    versions.saveVersion('test-snippet', 'v1');
    s._content = 'v2 content';
    versions.saveVersion('test-snippet', 'v2');
    s._content = 'v3 content';
    versions.saveVersion('test-snippet', 'v3');

    expect(storage.readSnippetContent(s)).toBe('v3 content');

    const result = versions.undo('test-snippet');
    expect(result).not.toBeNull();
    expect(result.content).toBe('v2 content');
    expect(result.version).toBe(2);

    expect(storage.readSnippetContent(s)).toBe('v2 content');
  });

  test('should not undo with only one version', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    storage._addMock('test-snippet', 'echo hello');
    versions.saveVersion('test-snippet', 'only version');

    const result = versions.undo('test-snippet');
    expect(result).toBeNull();
  });

  test('should handle missing snippet for saveVersion', () => {
    const versions = freshVersions();
    const result = versions.saveVersion('nonexistent', 'test');
    expect(result.version).toBe(0);
  });

  test('should prune versions above MAX_VERSIONS_PER_SNIPPET', () => {
    const storage = freshStorage();
    const versions = freshVersions();
    storage._addMock('test-snippet', 'initial');

    for (let i = 0; i < versions.MAX_VERSIONS_PER_SNIPPET + 5; i++) {
      versions.saveVersion('test-snippet', `Version ${i + 1}`);
    }

    const list = versions.listVersions('test-snippet');
    expect(list.length).toBeLessThanOrEqual(versions.MAX_VERSIONS_PER_SNIPPET);
  });
});

describe('diff module', () => {
  const diff = require('../lib/diff');

  test('should detect added lines', () => {
    const result = diff.diffLines('line1\nline2', 'line1\nline2\nline3');
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBe(2);

    const hasAdd = result.hunks.some(h => h.type === 'add' && h.lines.includes('line3'));
    expect(hasAdd).toBe(true);
  });

  test('should detect removed lines', () => {
    const result = diff.diffLines('line1\nline2\nline3', 'line1\nline3');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.unchanged).toBe(2);

    const hasRemove = result.hunks.some(h => h.type === 'remove' && h.lines.includes('line2'));
    expect(hasRemove).toBe(true);
  });

  test('should detect changed lines', () => {
    const result = diff.diffLines('hello world', 'hello there');
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
  });

  test('should return empty for identical content', () => {
    const result = diff.diffLines('same content', 'same content');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBe(1);
    expect(result.hunks.every(h => h.type === 'same')).toBe(true);
  });

  test('should handle empty strings', () => {
    const result = diff.diffLines('', '');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBe(1);
  });

  test('should format as JSON', () => {
    const result = diff.diffLines('a\nb\nc', 'a\nd\nc');
    const json = diff.formatDiffJSON(result);
    expect(json.stats).toBeDefined();
    expect(json.stats.added).toBe(1);
    expect(json.stats.removed).toBe(1);
    expect(json.changes).toBeInstanceOf(Array);
  });

  test('should format terminal output', () => {
    const result = diff.diffLines('hello', 'world');
    const output = diff.formatDiff(result);
    expect(output).toContain('+');
    expect(output).toContain('-');
  });

  test('should format unified output', () => {
    const result = diff.diffLines('a\nb\nc', 'a\nd\nc');
    const output = diff.formatUnified(result);
    expect(output).toContain('-b');
    expect(output).toContain('+d');
    expect(output).toContain(' a');
    expect(output).toContain(' c');
  });
});
