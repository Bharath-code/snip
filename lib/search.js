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

/** @type {Map<string, {results: Array, timestamp: number}>} */
const _queryCache = new Map();
const _QUERY_CACHE_TTL = 5000; // 5 seconds
const _QUERY_CACHE_MAX_SIZE = 100;

/**
 * Get the DB file mtime for cache invalidation (JSON or SQLite path).
 * @returns {number} mtime in milliseconds, or 0 if unavailable
 */
function _getDbMtime() {
  try {
    const cfg = config.loadConfig();
    const dbPath = cfg.useSqlite ? (cfg.sqlitePath || cfg.dbPath) : cfg.dbPath;
    const stat = fs.statSync(dbPath);
    return stat.mtimeMs;
  } catch (_) {
    return 0;
  }
}

/**
 * Build a fresh Fuse index (metadata only for lazy-load). Name weighted higher (5.6).
 * @param {Array} list - result of storage.listSnippets()
 * @returns {Fuse}
 */
function _buildFreshIndex(list) {
  const items = list.map(s => ({
    id: s.id,
    name: s.name,
    tags: s.tags || []
  }));

  return new Fuse(items, {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'tags', weight: 0.4 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  });
}

/**
 * Return a (possibly cached) Fuse index.
 * Invalidates when DB file mtime or snippet count changes. Single listSnippets() call per rebuild.
 * @returns {Fuse}
 */
function buildIndex() {
  const mtime = _getDbMtime();
  const list = storage.listSnippets();
  const count = list.length;

  if (_cachedFuse && mtime === _cachedMtime && count === _cachedCount) {
    return _cachedFuse;
  }

  _cachedFuse = _buildFreshIndex(list);
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
  _queryCache.clear();
}

/**
 * Fuzzy-search snippets by query string.
 * @param {string} query - Search query
 * @param {number} [limit=15] - Maximum results to return
 * @returns {Array<{id: string, name: string, tags: string[]}>}
 */
function search(query, limit = 15) {
  if (!query || !String(query).trim()) {
    const list = storage.listSnippets();
    return list.slice(0, limit).map(s => ({ id: s.id, name: s.name, tags: s.tags || [] }));
  }

  const cacheKey = `${query}:${limit}`;
  const now = Date.now();
  const cached = _queryCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < _QUERY_CACHE_TTL) {
    return cached.results;
  }

  const fuse = buildIndex();
  const res = fuse.search(query, { limit });
  const results = res.map(r => r.item);

  if (_queryCache.size >= _QUERY_CACHE_MAX_SIZE) {
    const firstKey = _queryCache.keys().next().value;
    _queryCache.delete(firstKey);
  }
  _queryCache.set(cacheKey, { results, timestamp: now });

  return results;
}

/**
 * Return a few snippet names similar to query (for "Did you mean?" hints).
 * @param {string} query
 * @param {number} limit
 * @returns {string[]} snippet names
 */
function suggestSimilar(query, limit = 3) {
  if (!query || !String(query).trim()) return [];
  const fuse = buildIndex();
  const res = fuse.search(query, { limit });
  return res.map(r => r.item.name).filter(Boolean);
}

module.exports = { search, suggestSimilar, invalidateCache };
