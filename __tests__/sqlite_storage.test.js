/**
 * Tests for SQLite/sql.js backend paths in lib/storage.js.
 *
 * These tests enable useSqlite so that storage operations go through the
 * sql.js WASM-based SQLite backend (a devDependency). They cover the same
 * operations as the JSON backend tests but through the SQLite code path.
 *
 * Key functions tested via SQLite:
 * - addSnippet (INSERT)
 * - listSnippets (SELECT)
 * - getSnippetByIdOrName (SELECT by id/name)
 * - readSnippetContent (SELECT content)
 * - updateSnippetContent (UPDATE)
 * - updateSnippetMeta (UPDATE name, tags, language)
 * - updateSnippetUpdatedAt (UPDATE updatedAt)
 * - touchUsage (UPDATE usageCount)
 * - deleteSnippetById (DELETE)
 * - setSnippetOrigin (UPDATE origin)
 * - flush (persist sql.js to disk)
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

describe('SQLite storage backend (sql.js)', () => {
  let testDir;
  let originalEnv;
  let storage;
  let config;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-sqlite-test-${Date.now()}`);
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
    config = require('../lib/config');

    // Enable SQLite mode — write config before storage is loaded
    config.saveConfig({ useSqlite: true, sqlitePath: path.join(testDir, 'snip.sqlite') });

    // Re-require config to pick up the new settings
    jest.resetModules();
    config = require('../lib/config');
    storage = require('../lib/storage');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  // ── addSnippet (SQLite INSERT) ──

  describe('addSnippet (SQLite)', () => {
    test('adds a snippet via SQLite', () => {
      const s = storage.addSnippet({ name: 'sqlite-add', content: 'echo hello', language: 'sh', tags: ['test', 'sqlite'] });
      expect(s).toBeDefined();
      expect(s.id).toBeTruthy();
      expect(s.name).toBe('sqlite-add');
      expect(s.language).toBe('sh');
      expect(s.tags).toEqual(['test', 'sqlite']);
      expect(s.content).toBe('echo hello');
    });

    test('auto-generates an id', () => {
      const s = storage.addSnippet({ name: 'auto-id', content: 'test' });
      expect(s.id).toBeTruthy();
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(10);
    });

    test('stores content inline (not in a separate file)', () => {
      const s = storage.addSnippet({ name: 'inline-content', content: 'multi\nline\ncontent', language: 'py' });
      // SQLite stores content in the DB, not in a file
      expect(s.path).toBeNull();
      // readSnippetContent should return the content from DB
      const content = storage.readSnippetContent(s);
      expect(content).toBe('multi\nline\ncontent');
    });

    test('rejects invalid snippet name', () => {
      expect(() => {
        storage.addSnippet({ name: '', content: 'test' });
      }).toThrow('Invalid snippet name');
    });
  });

  // ── listSnippets (SQLite SELECT) ──

  describe('listSnippets (SQLite)', () => {
    test('returns empty array when no snippets', () => {
      const list = storage.listSnippets();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    test('returns all added snippets', () => {
      storage.addSnippet({ name: 'list-a', content: 'echo a', language: 'sh' });
      storage.addSnippet({ name: 'list-b', content: 'echo b', language: 'sh' });

      const list = storage.listSnippets();
      expect(list.length).toBe(2);
      const names = list.map(s => s.name).sort();
      expect(names).toEqual(['list-a', 'list-b']);
    });

    test('returns metadata only (no content)', () => {
      storage.addSnippet({ name: 'meta-only', content: 'secret content', language: 'sh' });
      const list = storage.listSnippets();
      const found = list.find(s => s.name === 'meta-only');
      expect(found).toBeDefined();
      // listSnippets should not include content
      expect(found.content).toBeUndefined();
    });

    test('includes tags as array', () => {
      storage.addSnippet({ name: 'tagged', content: 'test', tags: ['a', 'b', 'c'] });
      const list = storage.listSnippets();
      const found = list.find(s => s.name === 'tagged');
      expect(found.tags).toEqual(['a', 'b', 'c']);
    });

    test('includes usageCount and lastUsedAt', () => {
      storage.addSnippet({ name: 'usage-stat', content: 'test', language: 'sh' });
      const list = storage.listSnippets();
      const found = list.find(s => s.name === 'usage-stat');
      expect(found).toHaveProperty('usageCount');
      expect(found).toHaveProperty('lastUsedAt');
    });
  });

  // ── getSnippetByIdOrName (SQLite) ──

  describe('getSnippetByIdOrName (SQLite)', () => {
    test('finds snippet by id', () => {
      const s = storage.addSnippet({ name: 'find-by-id', content: 'test', language: 'sh' });
      const found = storage.getSnippetByIdOrName(s.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('find-by-id');
    });

    test('finds snippet by name', () => {
      storage.addSnippet({ name: 'find-by-name', content: 'test', language: 'sh' });
      const found = storage.getSnippetByIdOrName('find-by-name');
      expect(found).toBeDefined();
      expect(found.name).toBe('find-by-name');
    });

    test('returns null for nonexistent snippet', () => {
      const found = storage.getSnippetByIdOrName('nonexistent');
      expect(found).toBeNull();
    });

    test('returns metadata only (no content in list query)', () => {
      const s = storage.addSnippet({ name: 'no-content-get', content: 'hidden', language: 'sh' });
      const found = storage.getSnippetByIdOrName(s.id);
      expect(found.content).toBeUndefined();
    });
  });

  // ── readSnippetContent (SQLite) ──

  describe('readSnippetContent (SQLite)', () => {
    test('reads content from SQLite', () => {
      const s = storage.addSnippet({ name: 'read-content', content: 'hello world', language: 'sh' });
      const content = storage.readSnippetContent(s);
      expect(content).toBe('hello world');
    });

    test('reads multi-line content', () => {
      const multiLine = 'line1\nline2\nline3';
      const s = storage.addSnippet({ name: 'multi-line', content: multiLine });
      const content = storage.readSnippetContent(s);
      expect(content).toBe(multiLine);
    });

    test('returns empty string for null snippet', () => {
      const content = storage.readSnippetContent(null);
      expect(content).toBe('');
    });

    test('fetches content by id when snippet object has no content', () => {
      const s = storage.addSnippet({ name: 'lazy-load', content: 'deferred load test', language: 'sh' });
      // Remove content from object to simulate lazy-loaded scenario
      const withoutContent = { id: s.id, name: s.name };
      const content = storage.readSnippetContent(withoutContent);
      expect(content).toBe('deferred load test');
    });
  });

  // ── updateSnippetContent (SQLite UPDATE) ──

  describe('updateSnippetContent (SQLite)', () => {
    test('updates content and updatedAt', () => {
      const s = storage.addSnippet({ name: 'update-content', content: 'original', language: 'sh' });
      const before = storage.getSnippetByIdOrName(s.id);

      storage.updateSnippetContent(s.id, 'updated version');

      const after = storage.readSnippetContent(storage.getSnippetByIdOrName(s.id));
      expect(after).toBe('updated version');
      expect(new Date(before.updatedAt).getTime()).toBeLessThanOrEqual(new Date(storage.getSnippetByIdOrName(s.id).updatedAt).getTime());
    });
  });

  // ── updateSnippetMeta (SQLite) ──

  describe('updateSnippetMeta (SQLite)', () => {
    test('updates name', () => {
      const s = storage.addSnippet({ name: 'old-name', content: 'test', language: 'sh' });
      storage.updateSnippetMeta(s.id, { name: 'new-name' });
      const updated = storage.getSnippetByIdOrName('new-name');
      expect(updated).toBeDefined();
      expect(updated.name).toBe('new-name');
      // Old name should not work
      expect(storage.getSnippetByIdOrName('old-name')).toBeNull();
    });

    test('updates tags', () => {
      const s = storage.addSnippet({ name: 'tag-update', content: 'test', tags: ['old'] });
      storage.updateSnippetMeta(s.id, { tags: ['new', 'tags'] });
      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.tags).toEqual(['new', 'tags']);
    });

    test('updates language', () => {
      const s = storage.addSnippet({ name: 'lang-update', content: 'test', language: 'sh' });
      storage.updateSnippetMeta(s.id, { language: 'python' });
      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.language).toBe('python');
    });
  });

  // ── updateSnippetUpdatedAt (SQLite) ──

  describe('updateSnippetUpdatedAt (SQLite)', () => {
    test('updates the updatedAt timestamp', () => {
      const s = storage.addSnippet({ name: 'update-time', content: 'test', language: 'sh' });
      const before = storage.getSnippetByIdOrName(s.id);

      // Small delay to ensure timestamp difference
      const beforeTime = new Date(before.updatedAt).getTime();
      storage.updateSnippetUpdatedAt(s.id);

      const after = storage.getSnippetByIdOrName(s.id);
      expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  // ── touchUsage (SQLite) ──

  describe('touchUsage (SQLite)', () => {
    test('increments usageCount', () => {
      const s = storage.addSnippet({ name: 'touch-usage', content: 'test', language: 'sh' });
      expect(s.usageCount).toBe(0);

      storage.touchUsage(storage.getSnippetByIdOrName(s.id));
      const after = storage.getSnippetByIdOrName(s.id);
      expect(after.usageCount).toBe(1);

      storage.touchUsage(storage.getSnippetByIdOrName(s.id));
      const after2 = storage.getSnippetByIdOrName(s.id);
      expect(after2.usageCount).toBe(2);
    });

    test('sets lastUsedAt', () => {
      const s = storage.addSnippet({ name: 'touch-time', content: 'test', language: 'sh' });
      expect(s.lastUsedAt).toBeNull();

      storage.touchUsage(storage.getSnippetByIdOrName(s.id));
      const after = storage.getSnippetByIdOrName(s.id);
      expect(after.lastUsedAt).toBeTruthy();
    });
  });

  // ── deleteSnippetById (SQLite DELETE) ──

  describe('deleteSnippetById (SQLite)', () => {
    test('removes snippet from database', () => {
      const s = storage.addSnippet({ name: 'to-delete', content: 'delete me', language: 'sh' });
      expect(storage.getSnippetByIdOrName(s.id)).toBeDefined();

      storage.deleteSnippetById(s.id);
      expect(storage.getSnippetByIdOrName(s.id)).toBeNull();
    });

    test('removes from list results', () => {
      storage.addSnippet({ name: 'keep', content: 'a', language: 'sh' });
      const del = storage.addSnippet({ name: 'remove', content: 'b', language: 'sh' });

      storage.deleteSnippetById(del.id);

      const list = storage.listSnippets();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('keep');
    });
  });

  // ── setSnippetOrigin (SQLite) ──

  describe('setSnippetOrigin (SQLite)', () => {
    test('sets origin on a snippet', () => {
      const s = storage.addSnippet({ name: 'origin-sqlite', content: 'test', language: 'sh' });
      storage.setSnippetOrigin(s.id, { gistId: 'abc-123' });

      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.origin).toEqual({ gistId: 'abc-123' });
    });

    test('replaces existing origin', () => {
      const s = storage.addSnippet({ name: 'origin-replace', content: 'test', language: 'sh' });
      storage.setSnippetOrigin(s.id, { gistId: 'first' });
      storage.setSnippetOrigin(s.id, { gistId: 'second' });

      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.origin.gistId).toBe('second');
    });
  });

  // ── flush (SQLite persist) ──

  describe('flush (SQLite persist)', () => {
    test('persists data to disk', () => {
      const s = storage.addSnippet({ name: 'flush-test', content: 'persist me', language: 'sh' });
      storage.flush();

      // Verify the file exists and has content
      const cfg = require('../lib/config').loadConfig();
      const dbFile = cfg.sqlitePath;
      expect(fs.existsSync(dbFile)).toBe(true);
      expect(fs.statSync(dbFile).size).toBeGreaterThan(0);
    });
  });
});
