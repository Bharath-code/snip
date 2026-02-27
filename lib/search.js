/**
 * Fuzzy search engine for snippets.
 *
 * Uses Fuse.js with mtime-based cache invalidation to avoid
 * rebuilding the index on every query.
 *
 * @module search
 */

const fs = require('fs');
const Fuse = require('fuse.js');
const storage = require('./storage');
const config = require('./config');

/** @type {Fuse|null} */
let _cachedFuse = null;
/** @type {number} */
let _cachedMtime = 0;
/** @type {number} */
let _cachedCount = -1;

/**
 * Get the DB file mtime for cache invalidation (JSON backend).
 * @returns {number} mtime in milliseconds, or 0 if unavailable
 */
function _getDbMtime() {
  try {
    const cfg = config.loadConfig();
    const stat = fs.statSync(cfg.dbPath);
    return stat.mtimeMs;
  } catch (_) {
    return 0;
  }
}

/**
 * Build a fresh Fuse index from all snippets.
 * @returns {Fuse}
 */
function _buildFreshIndex() {
  const items = storage.listSnippets().map(s => ({
    id: s.id,
    name: s.name,
    tags: s.tags,
    content: (storage.readSnippetContent(s) || '').slice(0, 1000)
  }));

  return new Fuse(items, {
    keys: ['name', 'tags', 'content'],
    threshold: 0.4,
    ignoreLocation: true
  });
}

/**
 * Return a (possibly cached) Fuse index.
 * Invalidates when:
 *  - DB file mtime changed (JSON backend)
 *  - Snippet count changed (SQLite backend / fallback)
 * @returns {Fuse}
 */
function buildIndex() {
  const mtime = _getDbMtime();
  const count = storage.listSnippets().length;

  if (_cachedFuse && mtime === _cachedMtime && count === _cachedCount) {
    return _cachedFuse;
  }

  _cachedFuse = _buildFreshIndex();
  _cachedMtime = mtime;
  _cachedCount = count;
  return _cachedFuse;
}

/**
 * Force-clear the cached index.
 * Useful in tests or after bulk mutations.
 */
function invalidateCache() {
  _cachedFuse = null;
  _cachedMtime = 0;
  _cachedCount = -1;
}

/**
 * Fuzzy-search snippets by query string.
 * @param {string} query - Search query
 * @param {number} [limit=15] - Maximum results to return
 * @returns {Array<{id: string, name: string, tags: string[]}>}
 */
function search(query, limit = 15) {
  const fuse = buildIndex();
  const res = fuse.search(query, { limit });
  return res.map(r => r.item);
}

module.exports = { search, invalidateCache };
