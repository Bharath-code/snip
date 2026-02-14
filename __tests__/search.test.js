const storage = require('../lib/storage');
const search = require('../lib/search');

describe('search', () => {
  test('finds snippet content', () => {
    const s = storage.addSnippet({ name: 'searchtest', content: 'unique-content-xyz123', language: 'txt', tags: ['u'] });
    const results = search.search('xyz123', 200);
    const ids = results.map(r => r.id);
    expect(ids).toContain(s.id);
  });
});
