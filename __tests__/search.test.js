const storage = require('../lib/storage');
const search = require('../lib/search');

describe('search', () => {
  test('finds snippet by name and tags', () => {
    const s = storage.addSnippet({ name: 'searchtest-foo', content: 'echo hello', language: 'txt', tags: ['uniquetag'] });
    const byName = search.search('searchtest', 200);
    const byTag = search.search('uniquetag', 200);
    expect(byName.map(r => r.id)).toContain(s.id);
    expect(byTag.map(r => r.id)).toContain(s.id);
  });
});
