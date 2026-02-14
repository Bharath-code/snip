const storage = require('../lib/storage');
const listCmd = require('../lib/commands/list');

function captureLogs(fn) {
  const lines = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((msg) => {
    lines.push(String(msg));
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return lines;
}

function busyWait(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

describe('list sorting', () => {
  test('sorts by name', () => {
    const lang = `sort-name-${Date.now()}`;
    const z = storage.addSnippet({ name: 'zzz-item', content: 'echo z', language: lang, tags: ['sort'] });
    const a = storage.addSnippet({ name: 'aaa-item', content: 'echo a', language: lang, tags: ['sort'] });
    const m = storage.addSnippet({ name: 'mmm-item', content: 'echo m', language: lang, tags: ['sort'] });

    const lines = captureLogs(() => listCmd({ lang, sort: 'name' }));
    const ids = lines.map(l => l.split('  ')[0]);

    expect(ids).toEqual([a.id, m.id, z.id]);
  });

  test('sorts by usage', () => {
    const lang = `sort-usage-${Date.now()}`;
    const low = storage.addSnippet({ name: 'low-use', content: 'echo low', language: lang, tags: ['sort'] });
    const high = storage.addSnippet({ name: 'high-use', content: 'echo high', language: lang, tags: ['sort'] });
    const mid = storage.addSnippet({ name: 'mid-use', content: 'echo mid', language: lang, tags: ['sort'] });
    storage.touchUsage(high);
    storage.touchUsage(high);
    storage.touchUsage(mid);

    const lines = captureLogs(() => listCmd({ lang, sort: 'usage' }));
    const ids = lines.map(l => l.split('  ')[0]);

    expect(ids).toEqual([high.id, mid.id, low.id]);
  });

  test('sorts by recent', () => {
    const lang = `sort-recent-${Date.now()}`;
    const old = storage.addSnippet({ name: 'old-touch', content: 'echo old', language: lang, tags: ['sort'] });
    const mid = storage.addSnippet({ name: 'mid-touch', content: 'echo mid', language: lang, tags: ['sort'] });
    const latest = storage.addSnippet({ name: 'latest-touch', content: 'echo latest', language: lang, tags: ['sort'] });

    storage.touchUsage(old);
    busyWait(4);
    storage.touchUsage(mid);
    busyWait(4);
    storage.touchUsage(latest);

    const lines = captureLogs(() => listCmd({ lang, sort: 'recent' }));
    const ids = lines.map(l => l.split('  ')[0]);

    expect(ids).toEqual([latest.id, mid.id, old.id]);
  });
});
