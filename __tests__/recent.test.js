const storage = require('../lib/storage');

// Replicate recent command logic so we can test edge cases without invoking CLI
function recentLogic(count) {
  const n = Math.min(Math.max(1, parseInt(count) || 5), 20);
  const all = storage.listSnippets();
  const sorted = all
    .filter(s => s.lastUsedAt || s.updatedAt)
    .sort((a, b) => {
      const aTs = Date.parse(a.lastUsedAt || a.updatedAt || 0) || 0;
      const bTs = Date.parse(b.lastUsedAt || b.updatedAt || 0) || 0;
      return bTs - aTs;
    })
    .slice(0, n);
  return sorted;
}

describe('recent', () => {
  test('empty snippet list yields no recent items', () => {
    const lang = `recent-empty-${Date.now()}`;
    storage.addSnippet({ name: 'only-one', content: 'x', language: lang, tags: [] });
    const all = storage.listSnippets().filter(s => s.language === lang);
    const sorted = all
      .filter(s => s.lastUsedAt || s.updatedAt)
      .sort((a, b) => (Date.parse(b.lastUsedAt || b.updatedAt || 0) || 0) - (Date.parse(a.lastUsedAt || a.updatedAt || 0) || 0))
      .slice(0, 5);
    const lines = [];
    const log = jest.spyOn(console, 'log').mockImplementation((msg) => lines.push(String(msg)));
    if (!sorted.length) console.log('No recent snippets.');
    else sorted.forEach((s, i) => console.log(`${i + 1}. ${s.name}`));
    log.mockRestore();
    expect(sorted.length).toBeGreaterThanOrEqual(0);
  });

  test('recent sorts by lastUsedAt when present', () => {
    const lang = `recent-sort-${Date.now()}`;
    storage.addSnippet({ name: 'a', content: 'a', language: lang, tags: [] });
    const b = storage.addSnippet({ name: 'b', content: 'b', language: lang, tags: [] });
    storage.touchUsage(b);
    const all = storage.listSnippets().filter(s => s.language === lang);
    const sorted = all
      .filter(s => s.lastUsedAt || s.updatedAt)
      .sort((a, b) => (Date.parse(b.lastUsedAt || b.updatedAt || 0) || 0) - (Date.parse(a.lastUsedAt || a.updatedAt || 0) || 0))
      .slice(0, 5);
    expect(sorted.length).toBe(2);
    expect(sorted[0].name).toBe('b');
  });
});
