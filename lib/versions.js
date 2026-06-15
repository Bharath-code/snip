/**
 * lib/versions.js — snippet versioning / history module
 *
 * Stores version snapshots of snippet content with timestamps.
 * Supports both JSON file backend (default) and SQLite backend.
 *
 * API:
 *   saveVersion(snippetId, message) — snapshot current content before edit
 *   listVersions(snippetId) — [{version, timestamp, message}]
 *   getVersionContent(snippetId, version) — content string or null
 *   getLatestVersion(snippetId) — latest version number or 0
 *   undo(snippetId) — rollback to previous version, returns {content, version}
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const storage = require('./storage');
const { useSqlite } = config;

const MAX_VERSIONS_PER_SNIPPET = 50;

// ── SQLite connection cache for versions ──
let _versionsDb = null;
let _versionsDbPath = null;

function tryRequireSqlite() {
  try { return require('better-sqlite3'); } catch (_) { return null; }
}

function tryRequireSqlJs() {
  try { return require('sql.js'); } catch (_) { return null; }
}

function getVersionsDb() {
  const cfg = config.loadConfig();
  if (!useSqlite(cfg)) {
    return null;
  }

  const dbFile = cfg.sqlitePath || cfg.dbPath;
  if (!dbFile) return null;
  const versionsFile = dbFile.replace(/\.(sqlite|db)$/, '-versions.$1');

  // Return cached connection if path matches
  if (_versionsDb && _versionsDbPath === versionsFile) return _versionsDb;

  // Close any existing connection with different path
  if (_versionsDb) {
    try {
      if (typeof _versionsDb.close === 'function') {
        _versionsDb.close();
      } else if (_versionsDb._db && typeof _versionsDb._db.close === 'function') {
        _versionsDb._db.close();
      }
    } catch (_) {}
    _versionsDb = null;
  }

  const Better = tryRequireSqlite();
  if (Better) {
    try {
      const db = new Better(versionsFile);
      db.exec(`CREATE TABLE IF NOT EXISTS snippet_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snippet_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        message TEXT
      )`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_versions_snippet_id ON snippet_versions(snippet_id)`);
      _versionsDb = db;
      _versionsDbPath = versionsFile;
      return db;
    } catch (_dbErr) {
      // Fall through to sql.js
    }
  }

  const sqljs = tryRequireSqlJs();
  if (sqljs) {
    try {
      const SQL = sqljs.Database || (sqljs.default && sqljs.default.Database);
      let dbInstance;
      if (fs.existsSync(versionsFile)) {
        const buf = fs.readFileSync(versionsFile);
        dbInstance = new SQL(new Uint8Array(buf));
      } else {
        dbInstance = new SQL();
      }

      dbInstance.run(`CREATE TABLE IF NOT EXISTS snippet_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snippet_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        message TEXT
      )`);
      dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_versions_snippet_id ON snippet_versions(snippet_id)`);

      const adapter = {
        _isSqlJs: true,
        _db: dbInstance,
        _filePath: versionsFile,
        exec: (sql) => dbInstance.run(sql),
        prepare: (sql) => ({
          run: function (...params) {
            const stmt = dbInstance.prepare(sql);
            if (params && params.length) stmt.bind(params);
            stmt.run();
            stmt.free();
            // Get last insert ID from Sqlite context
            const stmt2 = dbInstance.prepare('SELECT last_insert_rowid() as id');
            let lastInsertRowid = undefined;
            if (stmt2.step()) {
              lastInsertRowid = stmt2.getAsObject().id;
            }
            stmt2.free();
            return { lastInsertRowid };
          },
          get: function (...params) {
            const stmt = dbInstance.prepare(sql);
            if (params && params.length) stmt.bind(params);
            let row = null;
            if (stmt.step()) row = stmt.getAsObject();
            stmt.free();
            return row;
          },
          all: function (...params) {
            const stmt = dbInstance.prepare(sql);
            if (params && params.length) stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
          }
        }),
        persist: function () {
          try {
            const bytes = dbInstance.export();
            fs.writeFileSync(versionsFile, Buffer.from(bytes));
          } catch (e) {
            console.warn('Failed to persist versions sql.js DB to disk:', e.message);
          }
        }
      };

      _versionsDb = adapter;
      _versionsDbPath = versionsFile;
      return adapter;
    } catch (_sqlJsErr) {
      // Fall through to JSON backend
    }
  }

  // fallback to JSON versions db if neither sqlite is available
  return null;
}

// ── Backend helpers ──

function versionsDbPath() {
  const cfg = config.loadConfig();
  const dir = cfg.dataDir || path.join(require('os').homedir(), '.local', 'share', 'snip');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'versions.json');
}

function loadVersionsDb() {
  const dbPath = versionsDbPath();
  try {
    if (!fs.existsSync(dbPath)) return {};
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveVersionsDb(db) {
  const dbPath = versionsDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// ── Core API ──

/**
 * Save a version snapshot of a snippet's current content.
 * Called automatically before content changes.
 * @param {string} snippetId
 * @param {string} [message] - Optional description (e.g., "Before edit on 2026-06-14")
 * @returns {{version: number}} The saved version info
 */
function saveVersion(snippetId, message) {
  const snippet = storage.getSnippetByIdOrName(snippetId);
  if (!snippet) return { version: 0 };

  const content = storage.readSnippetContent(snippet);
  if (content === undefined || content === null) return { version: 0 };

  // Try SQLite backend first
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    return saveVersionSqlite(snippetId, content, message || `Snapshot ${new Date().toLocaleString()}`);
  }

  // JSON backend
  const db = loadVersionsDb();
  if (!db[snippetId]) db[snippetId] = [];
  const versions = db[snippetId];

  const version = versions.length + 1;
  const timestamp = new Date().toISOString();
  const msg = message || `Version ${version}`;

  versions.push({ version, content, timestamp, message: msg });

  // Prune oldest versions above the limit
  if (versions.length > MAX_VERSIONS_PER_SNIPPET) {
    const excess = versions.length - MAX_VERSIONS_PER_SNIPPET;
    db[snippetId] = versions.slice(excess);
  }

  saveVersionsDb(db);
  return { version };
}

/**
 * Save version to SQLite backend.
 * Uses a cached connection to the versions database.
 */
function saveVersionSqlite(snippetId, content, message) {
  try {
    const sqliteDb = getVersionsDb();
    if (!sqliteDb) throw new Error('No SQLite connection');

    // Count existing versions and prune if needed
    const count = sqliteDb.prepare('SELECT COUNT(*) as cnt FROM snippet_versions WHERE snippet_id = ?').get(snippetId);
    if (count.cnt >= MAX_VERSIONS_PER_SNIPPET) {
      // Delete oldest to make room
      sqliteDb.prepare(`DELETE FROM snippet_versions WHERE snippet_id = ? AND id IN (
        SELECT id FROM snippet_versions WHERE snippet_id = ? ORDER BY id ASC LIMIT ?
      )`).run(snippetId, snippetId, count.cnt - MAX_VERSIONS_PER_SNIPPET + 1);
    }

    const stmt = sqliteDb.prepare('INSERT INTO snippet_versions (snippet_id, content, timestamp, message) VALUES (?, ?, ?, ?)');
    const result = stmt.run(snippetId, content, new Date().toISOString(), message);
    if (sqliteDb._isSqlJs) sqliteDb.persist();

    return { version: Number(result.lastInsertRowid) };
  } catch {
    // Invalidate cached connection to force reconnection on next call
    _versionsDb = null;
    _versionsDbPath = null;
    // Fall back to JSON backend
    const db = loadVersionsDb();
    if (!db[snippetId]) db[snippetId] = [];
    const versions = db[snippetId];

    const version = versions.length + 1;
    const timestamp = new Date().toISOString();
    versions.push({ version, content, timestamp, message });

    if (versions.length > MAX_VERSIONS_PER_SNIPPET) {
      const excess = versions.length - MAX_VERSIONS_PER_SNIPPET;
      db[snippetId] = versions.slice(excess);
    }

    saveVersionsDb(db);
    return { version };
  }
}

/**
 * List all versions for a snippet.
 * @param {string} snippetId
 * @returns {Array<{version: number, timestamp: string, message: string}>}
 */
function listVersions(snippetId) {
  const sqliteDb = getVersionsDb();
  if (sqliteDb) {
    try {
      const rows = sqliteDb.prepare(
        'SELECT id as version, timestamp, message FROM snippet_versions WHERE snippet_id = ? ORDER BY id ASC'
      ).all(snippetId);
      if (rows.length > 0) return rows;
    } catch { /* fall through to JSON */ }
  }

  const db = loadVersionsDb();
  if (!db[snippetId]) return [];
  return db[snippetId].map(v => ({
    version: v.version,
    timestamp: v.timestamp,
    message: v.message,
  }));
}

/**
 * Get the content of a specific version.
 * @param {string} snippetId
 * @param {number} version - Version number (1-based)
 * @returns {string|null}
 */
function getVersionContent(snippetId, version) {
  const sqliteDb = getVersionsDb();
  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare(
        'SELECT content FROM snippet_versions WHERE snippet_id = ? AND id = ?'
      ).get(snippetId, version);
      if (row) return row.content;
    } catch { /* fall through to JSON */ }
  }

  const db = loadVersionsDb();
  if (!db[snippetId]) return null;
  const ver = db[snippetId].find(v => v.version === version);
  return ver ? ver.content : null;
}

/**
 * Get the latest version number for a snippet.
 * @param {string} snippetId
 * @returns {number}
 */
function getLatestVersion(snippetId) {
  const versions = listVersions(snippetId);
  return versions.length > 0 ? versions[versions.length - 1].version : 0;
}

/**
 * Undo (rollback) a snippet to its previous version.
 * Saves the current content as a new version first, then restores the previous.
 * @param {string} snippetId
 * @returns {{content: string|null, version: number, previousVersion: number}|null} The restored content, or null if nothing to undo
 */
function undo(snippetId) {
  const snippet = storage.getSnippetByIdOrName(snippetId);
  if (!snippet) return null;

  const versions = listVersions(snippetId);
  if (versions.length < 2) return null; // Need at least 2 versions to undo

  // Current latest version
  const latestVersion = versions[versions.length - 1].version;
  const targetVersion = versions[versions.length - 2].version;

  // Get the content to restore
  const targetContent = getVersionContent(snippetId, targetVersion);
  if (targetContent === null) return null;

  // Save current content as a version first (so undo is reversible)
  const currentContent = storage.readSnippetContent(snippet);
  if (currentContent) {
    saveVersion(snippetId, 'Before undo');
  }

  // Restore the previous version's content
  storage.updateSnippetContent(snippetId, targetContent);

  return {
    content: targetContent,
    version: targetVersion,
    previousVersion: latestVersion,
  };
}

/**
 * Get the count of versions for a snippet.
 * @param {string} snippetId
 * @returns {number}
 */
function versionCount(snippetId) {
  return listVersions(snippetId).length;
}

module.exports = {
  saveVersion,
  listVersions,
  getVersionContent,
  getLatestVersion,
  undo,
  versionCount,
  MAX_VERSIONS_PER_SNIPPET,
};
