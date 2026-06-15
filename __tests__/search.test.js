const storage = require('../lib/storage');
const search = require('../lib/search');

describe('search', () => {
  beforeEach(() => {
    search.invalidateCache();
  });

  test('finds snippet by name and tags', () => {
    const s = storage.addSnippet({ name: 'searchtest-foo', content: 'echo hello', language: 'txt', tags: ['uniquetag'] });
    const byName = search.search('searchtest', 200);
    const byTag = search.search('uniquetag', 200);
    expect(byName.map(r => r.id)).toContain(s.id);
    expect(byTag.map(r => r.id)).toContain(s.id);
  });

  test('finds snippet by content words', () => {
    const s = storage.addSnippet({
      name: 'docker-cleanup',
      content: 'docker system prune -af --volumes && docker image prune -a',
      language: 'sh',
      tags: ['docker', 'cleanup'],
    });

    // Search for words that only appear in content, not in name or tags
    const results = search.search('prune volumes', 200);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name === 'docker-cleanup')).toBe(true);
  });

  test('finds snippet by partial content match', () => {
    const s = storage.addSnippet({
      name: 'deploy',
      content: 'kubectl apply -f k8s/production.yaml && kubectl rollout status deployment/api',
      language: 'sh',
      tags: ['k8s'],
    });

    // Search for a specific command in the content
    const results = search.search('rollout status', 200);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name === 'deploy')).toBe(true);
  });
});
