const packs = require('../lib/packs');

// Mock global.fetch to avoid network calls in tests
let mockFetchResponse = {};
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(mockFetchResponse),
}));

describe('packs module', () => {
  test('BUILTIN_PACKS is an array with 6 items', () => {
    expect(Array.isArray(packs.BUILTIN_PACKS)).toBe(true);
    expect(packs.BUILTIN_PACKS.length).toBe(6);
  });

  test('each pack has required fields', () => {
    for (const p of packs.BUILTIN_PACKS) {
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.description).toBe('string');
      expect(typeof p.snippetCount).toBe('number');
      expect(p.snippetCount).toBeGreaterThan(0);
    }
  });

  test('pack names are unique', () => {
    const names = packs.BUILTIN_PACKS.map(p => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test('manifestUrl builds correct URL', () => {
    expect(packs.manifestUrl('docker-essentials')).toBe(
      'https://raw.githubusercontent.com/snip-packs/docker-essentials/main/pack.json'
    );
    expect(packs.manifestUrl('git-workflow')).toBe(
      'https://raw.githubusercontent.com/snip-packs/git-workflow/main/pack.json'
    );
  });

  test('manifestUrl accepts names with dots', () => {
    const url = packs.manifestUrl('node.js-ops');
    expect(url).toBe('https://raw.githubusercontent.com/snip-packs/node.js-ops/main/pack.json');
  });

  test('fetchPack throws for nonexistent pack', async () => {
    // Mock a 404 response
    global.fetch.mockImplementationOnce(() => Promise.resolve({
      ok: false,
      status: 404,
    }));
    await expect(packs.fetchPack('nonexistent-pack-xyz-999')).rejects
      .toThrow(/not found/);
  });

  test('fetchPack validates manifest has snippets array', async () => {
    mockFetchResponse = { name: 'test', version: '1.0' }; // no snippets array
    await expect(packs.fetchPack('test')).rejects
      .toThrow(/missing "snippets" array/);
  });

  test('fetchPack resolves local bundled pack without network fetch', async () => {
    global.fetch.mockClear();
    const manifest = await packs.fetchPack('docker-essentials');
    expect(manifest.name).toBe('docker-essentials');
    expect(Array.isArray(manifest.snippets)).toBe(true);
    expect(manifest.snippets.length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('install adds snippets with pack name as tag', async () => {
    mockFetchResponse = {
      name: 'test-pack',
      version: '1.0.0',
      description: 'A test pack',
      snippets: [
        { name: 'pack-test-a', content: 'echo a', language: 'sh', tags: ['test'] },
        { name: 'pack-test-b', content: 'echo b', language: 'sh' },
      ],
    };
    const result = await packs.install('test-pack');
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.name).toBe('test-pack');
  });
});
