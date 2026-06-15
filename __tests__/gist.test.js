/**
 * Tests for lib/sync/gist.js
 *
 * These tests mock the global `fetch` function to avoid actual network calls.
 * They cover: snippetToFile, createGist, pushSnippet, shareSnippet, sharePack,
 * deleteGist, pullGist, rate limiting, searchCodeGists, listRecentGists.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Mock fetch globally
let mockFetchImpl = null;
global.fetch = jest.fn(() => {
  if (!mockFetchImpl) {
    return Promise.reject(new Error('No mock fetch implementation set'));
  }
  return mockFetchImpl();
});

describe('gist module', () => {
  let testDir;
  let originalEnv;
  let gist;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-gist-test-${Date.now()}`);
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
    gist = require('../lib/sync/gist');
    mockFetchImpl = null;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  // ── snippetToFile ──

  describe('snippetToFile', () => {
    test('generates filename from snippet name and language', () => {
      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'my-script', content: 'echo hi', language: 'sh' });
      const { filename, content } = gist.snippetToFile(s);
      expect(filename).toBe('my-script.sh');
      expect(content).toBe('echo hi');
    });

    test('sanitizes unsafe characters in filename', () => {
      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'my script!@#', content: 'test', language: 'js' });
      const { filename } = gist.snippetToFile(s);
      expect(filename).toMatch(/^[a-z0-9_.-]+\.js$/i);
      expect(filename).not.toContain(' ');
      expect(filename).not.toContain('!');
    });

    test('handles missing language', () => {
      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'readme', content: '# Hello' });
      const { filename } = gist.snippetToFile(s);
      expect(filename).toBe('readme.txt');
    });
  });

  // ── createGist ──

  describe('createGist', () => {
    test('sends correct request to GitHub API', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'abc123', html_url: 'https://gist.github.com/abc123' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const result = await gist.createGist({
        description: 'snip: test',
        files: [{ filename: 'test.sh', content: 'echo hi' }],
        token: 'ghp_test',
        isPublic: true,
      });

      expect(result.id).toBe('abc123');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/gists',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'token ghp_test',
          }),
        })
      );
    });

    test('throws on 401 response', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.createGist({
        description: 'snip: test',
        files: [{ filename: 'test.sh', content: 'echo hi' }],
        token: 'bad-token',
      })).rejects.toThrow('Invalid GitHub token');
    });

    test('throws on non-401 error', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Validation error'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.createGist({
        description: 'snip: test',
        files: [{ filename: 'test.sh', content: '' }],
        token: 'ghp_test',
      })).rejects.toThrow('Gist push failed: 422');
    });
  });

  // ── pushSnippet ──

  describe('pushSnippet', () => {
    test('throws when snippet not found', async () => {
      await expect(gist.pushSnippet('nonexistent', 'ghp_test')).rejects.toThrow('Snippet not found');
    });

    test('successfully pushes a snippet', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'gist-123', html_url: 'https://gist.github.com/gist-123' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'push-test', content: 'echo pushed', language: 'sh' });

      const result = await gist.pushSnippet(s.name, 'ghp_test');
      expect(result.id).toBe('gist-123');
    });

    test('sets origin on successful push', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'gist-456', html_url: 'https://gist.github.com/gist-456' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'origin-test', content: 'echo test', language: 'sh' });

      await gist.pushSnippet(s.name, 'ghp_test');

      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.origin).toBeDefined();
      expect(updated.origin.gistId).toBe('gist-456');
    });
  });

  // ── shareSnippet ──

  describe('shareSnippet', () => {
    test('creates gist with isPublic: true', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'share-123' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'share-test', content: 'echo shared', language: 'sh' });

      const result = await gist.shareSnippet(s.name, 'ghp_test');
      expect(result.id).toBe('share-123');

      // Verify POST body includes public: false (default) — share sets isPublic: true internally
      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.public).toBe(true);
    });
  });

  // ── sharePack ──

  describe('sharePack', () => {
    test('shares multiple snippets as a single gist', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'pack-123' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s1 = storage.addSnippet({ name: 'pack-a', content: 'echo a', language: 'sh' });
      const s2 = storage.addSnippet({ name: 'pack-b', content: 'echo b', language: 'sh' });

      const result = await gist.sharePack([s1.name, s2.name], 'ghp_test');
      expect(result.id).toBe('pack-123');

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.public).toBe(true);
      expect(Object.keys(callBody.files).length).toBe(2);
    });

    test('throws when a snippet in the pack is not found', async () => {
      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'exists', content: 'echo hi', language: 'sh' });

      await expect(gist.sharePack([s.name, 'does-not-exist'], 'ghp_test')).rejects.toThrow('Snippet not found');
    });
  });

  // ── deleteGist ──

  describe('deleteGist', () => {
    test('successfully deletes a gist', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      const result = await gist.deleteGist('gist-123', 'ghp_test');
      expect(result).toBe(true);
    });

    test('throws 404 when gist not found', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.deleteGist('nonexistent', 'ghp_test')).rejects.toThrow('Gist not found');
    });

    test('throws 401 on bad token', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.deleteGist('gist-123', 'bad-token')).rejects.toThrow('Invalid GitHub token');
    });

    test('throws 403 on forbidden', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.deleteGist('gist-123', 'ghp_test')).rejects.toThrow('Cannot delete this gist');
    });
  });

  // ── pullGist ──

  describe('pullGist', () => {
    test('imports files from a gist as snippets', async () => {
      const gistResponse = {
        id: 'pull-123',
        files: {
          'script.sh': { filename: 'script.sh', content: 'echo hello' },
          'note.md': { filename: 'note.md', content: '# Note' },
        },
      };

      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gistResponse),
        headers: new Map([
          ['X-RateLimit-Remaining', '50'],
          ['content-length', '500'],
        ]),
      });

      const imported = await gist.pullGist('pull-123', 'ghp_test');
      expect(imported.length).toBe(2);
      const names = imported.map(s => s.name);
      // Names are sanitized by addSnippet — dots are stripped
      expect(names).toContain('script_sh');
      expect(names).toContain('note_md');
    });

    test('throws on oversized gist response (>5MB)', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: {} }),
        headers: new Map([
          ['X-RateLimit-Remaining', '50'],
          ['content-length', String(6 * 1024 * 1024)], // 6MB
        ]),
      });

      await expect(gist.pullGist('large-gist', 'ghp_test')).rejects.toThrow('too large');
    });

    test('throws 401 on bad token', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.pullGist('gist-123', 'bad-token')).rejects.toThrow('Invalid GitHub token');
    });
  });

  // ── Rate limiting ──

  describe('rate limiting', () => {
    test('enforces rate limit', async () => {
      // Make many requests to exhaust the rate limit
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Map([['X-RateLimit-Remaining', '50'], ['X-RateLimit-Reset', '9999999999']]),
      });

      // Exhaust the rate limit (50 requests per minute window)
      for (let i = 0; i < 50; i++) {
        await gist.createGist({ description: 'test', files: [{ filename: 't.txt', content: 'x' }], token: 't' });
      }

      // The 51st call should throw
      await expect(
        gist.createGist({ description: 'test', files: [{ filename: 't.txt', content: 'x' }], token: 't' })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  // ── searchCodeGists ──

  describe('searchCodeGists', () => {
    test('sends correct search request', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], total_count: 0 }),
        headers: new Map([['X-RateLimit-Remaining', '50'], ['X-RateLimit-Reset', '9999999999']]),
      });

      await gist.searchCodeGists('docker', 'ghp_test', { lang: 'yaml', limit: 10 });

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('search/code');
      expect(callUrl).toContain('q=docker');
      // language is URL-encoded in the query string
      expect(decodeURIComponent(callUrl)).toContain('language:yaml');
    });

    test('throws 401 on bad token', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Bad credentials'),
        headers: new Map([['X-RateLimit-Remaining', '50']]),
      });

      await expect(gist.searchCodeGists('docker', 'bad-token')).rejects.toThrow('Invalid GitHub token');
    });

    test('throws 403 on rate limit', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('rate limit exceeded'),
        headers: new Map([['X-RateLimit-Remaining', '0']]),
      });

      await expect(gist.searchCodeGists('docker', 'ghp_test')).rejects.toThrow('rate limit');
    });
  });

  // ── listRecentGists ──

  describe('listRecentGists', () => {
    test('fetches recent public gists', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 'gist-1' }, { id: 'gist-2' }]),
        headers: new Map([['X-RateLimit-Remaining', '50'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const result = await gist.listRecentGists('ghp_test', { limit: 10 });
      expect(result.length).toBe(2);
      expect(fetch.mock.calls[0][0]).toContain('gists/public');
    });

    test('throws 403 on rate limit', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('rate limit exceeded'),
        headers: new Map([['X-RateLimit-Remaining', '0']]),
      });

      await expect(gist.listRecentGists('ghp_test')).rejects.toThrow('rate limit');
    });
  });

  // ── markGistOrigin (indirectly via push/share) ──

  describe('origin tracking', () => {
    test('push sets origin.gistId', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'origin-gist-id' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'origin-test-2', content: 'echo origin', language: 'sh' });

      await gist.pushSnippet(s.name, 'ghp_test');

      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.origin).toEqual({ gistId: 'origin-gist-id' });
    });

    test('share sets origin.gistId', async () => {
      mockFetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'share-origin-id' }),
        headers: new Map([['X-RateLimit-Remaining', '58'], ['X-RateLimit-Reset', '9999999999']]),
      });

      const storage = require('../lib/storage');
      const s = storage.addSnippet({ name: 'share-origin-test', content: 'echo share', language: 'sh' });

      await gist.shareSnippet(s.name, 'ghp_test');

      const updated = storage.getSnippetByIdOrName(s.id);
      expect(updated.origin).toEqual({ gistId: 'share-origin-id' });
    });
  });
});
