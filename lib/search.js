const Fuse = require('fuse.js');
const storage = require('./storage');

function buildIndex() {
  const items = storage.listSnippets().map(s => ({
    id: s.id,
    name: s.name,
    tags: s.tags,
    content: (storage.readSnippetContent(s) || '').slice(0, 1000)
  }));
  const fuse = new Fuse(items, { keys: ['name', 'tags', 'content'], threshold: 0.4, ignoreLocation: true });
  return fuse;
}

function search(query, limit = 10) {
  const fuse = buildIndex();
  const res = fuse.search(query, { limit });
  return res.map(r => r.item);
}

module.exports = { search };
