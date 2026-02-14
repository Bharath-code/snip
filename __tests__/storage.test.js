const storage = require('../lib/storage');

describe('storage', () => {
  test('add and retrieve snippet', () => {
    const s = storage.addSnippet({ name: 'testunit', content: 'echo hi', language: 'sh', tags: ['test'] });
    expect(s).toBeDefined();
    expect(s).toHaveProperty('id');
    const list = storage.listSnippets();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find(x => x.id === s.id);
    expect(found).toBeDefined();
    const read = storage.getSnippetByIdOrName(s.id);
    expect(read.name).toBe('testunit');
  });
});
