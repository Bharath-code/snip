const os = require('os');
const fs = require('fs');
const path = require('path');

// Isolate from real data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-search-cache-'));
process.env.XDG_CONFIG_HOME = path.join(tmpDir, '.config');
process.env.XDG_DATA_HOME = path.join(tmpDir, '.local', 'share');

const storage = require('../lib/storage');
const search = require('../lib/search');

afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
});

describe('search caching', () => {
    beforeEach(() => {
        search.invalidateCache();
    });

    test('search returns results', () => {
        storage.addSnippet({ name: 'test-cache-alpha', content: 'echo alpha', language: 'sh', tags: ['cache'] });
        storage.addSnippet({ name: 'test-cache-beta', content: 'echo beta', language: 'sh', tags: ['cache'] });

        const results = search.search('alpha');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('test-cache-alpha');
    });

    test('new snippets appear in search after add', () => {
        storage.addSnippet({ name: 'cache-new-gamma', content: 'echo gamma', language: 'sh', tags: ['new'] });

        // The cache should invalidate due to count change
        const results = search.search('gamma');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('cache-new-gamma');
    });

    test('invalidateCache forces fresh index', () => {
        storage.addSnippet({ name: 'cache-delta', content: 'echo delta', language: 'sh', tags: ['delta'] });
        search.search('delta'); // warm cache

        search.invalidateCache();

        // Should still work after invalidation
        const results = search.search('delta');
        expect(results.length).toBeGreaterThan(0);
    });

    test('limit parameter caps results', () => {
        for (let i = 0; i < 5; i++) {
            storage.addSnippet({ name: `limit-test-${i}`, content: 'echo limit', language: 'sh', tags: ['limitgrp'] });
        }

        const results = search.search('limit', 2);
        expect(results.length).toBeLessThanOrEqual(2);
    });
});
