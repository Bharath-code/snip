const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function uuidv4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16));
}
const config = require('./config');

const DB_BACKUP = '.db.bak';

function useSqlite(cfg) {
  return cfg.useSqlite || (cfg.dbPath && (cfg.dbPath.endsWith('.sqlite') || cfg.dbPath.endsWith('.db')));
}

function tryRequireSqlite() {
  try {
    return require('better-sqlite3');
  } catch (e) {
    return null;
  }
}

function tryRequireSqlJs() {
  try {
    return require('sql.js');
  } catch (e) {
    return null;
  }
}

function ensureSqlite(dbPath) {
  const Better = tryRequireSqlite();
  if (Better) {
    const Database = Better;
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      name TEXT,
      content TEXT,
      language TEXT,
      tags TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      lastUsedAt TEXT,
      usageCount INTEGER DEFAULT 0,
      origin TEXT
    )`);
    return db;
  }

  const sqljs = tryRequireSqlJs();
  if (!sqljs) throw new Error('better-sqlite3 is not installed and sql.js is unavailable. Install better-sqlite3 or sql.js, or disable useSqlite in config.');

  const SQL = sqljs.Database || (sqljs.default && sqljs.default.Database);
  let dbInstance;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    dbInstance = new SQL(new Uint8Array(buf));
  } else {
    dbInstance = new SQL();
  }

  dbInstance.run(`CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    language TEXT,
    tags TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    lastUsedAt TEXT,
    usageCount INTEGER DEFAULT 0,
    origin TEXT
  )`);

  // Adapter to provide prepare().all(), .get(), .run() like better-sqlite3
  const adapter = {
    _isSqlJs: true,
    _db: dbInstance,
    _filePath: dbPath,
    exec: (sql) => dbInstance.run(sql),
    prepare: (sql) => ({
      run: function (...params) {
        const stmt = dbInstance.prepare(sql);
        if (params && params.length) stmt.bind(params);
        stmt.run();
        stmt.free();
      },
      get: function (...params) {
        const stmt = dbInstance.prepare(sql);
        if (params && params.length) stmt.bind(params);
        // advance to first row
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
        fs.writeFileSync(dbPath, Buffer.from(bytes));
      } catch (e) {
        console.warn('Failed to persist sql.js DB to disk:', e.message);
      }
    }
  };

  return adapter;
}

function loadDB() {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      const db = ensureSqlite(dbFile);
      // return a shim object pointing to sqlite
      return { _sqlite: db };
    } catch (e) {
      console.warn('SQLite requested but unavailable; falling back to JSON DB. To enable sqlite install better-sqlite3 or disable useSqlite.');
    }
  }

  const dbPath = cfg.dbPath;
  try {
    if (!fs.existsSync(dbPath)) return { snippets: {} };
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    try {
      const bak = dbPath + DB_BACKUP;
      if (fs.existsSync(bak)) return JSON.parse(fs.readFileSync(bak, 'utf8'));
    } catch (e2) { }
    return { snippets: {} };
  }
}

function saveDB(db) {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    try {
      const sqljs = tryRequireSqlJs();
      if (sqljs) {
        const sqliteDb = ensureSqlite(dbFile);
        if (sqliteDb && sqliteDb._isSqlJs && typeof sqliteDb.persist === 'function') {
          sqliteDb.persist();
          return;
        }
      }
    } catch (e) {
      // ignore and fall back to JSON persist below
    }
    // sqlite (better-sqlite3) does immediate writes; for other cases nothing to do
    return;
  }
  const dbPath = cfg.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try { if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, dbPath + DB_BACKUP); } catch (e) { }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function dataDir() { return config.loadConfig().dataDir; }

function snippetsDir() {
  const dir = path.join(dataDir(), 'snippets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function addSnippet({ name, content, language, tags }) {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO snippets (id,name,content,language,tags,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)');
    stmt.run(id, name, content, language || '', JSON.stringify(tags || []), now, now);
    if (db._isSqlJs) db.persist();
    return { id, name, content, language: language || '', tags: tags || [], createdAt: now, updatedAt: now, path: null };
  }

  const db = loadDB();
  const id = uuidv4();
  const fileName = id + (language ? '.' + language : '.txt');
  const filePath = path.join(snippetsDir(), fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  const now = new Date().toISOString();
  db.snippets[id] = {
    id,
    name,
    path: filePath,
    language: language || '',
    tags: tags || [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    usageCount: 0
  };
  saveDB(db);
  return db.snippets[id];
}

function listSnippets() {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    const rows = db.prepare('SELECT id,name,language,tags,createdAt,updatedAt,lastUsedAt,usageCount,origin FROM snippets').all();
    return rows.map(r => ({ id: r.id, name: r.name, language: r.language, tags: JSON.parse(r.tags || '[]'), createdAt: r.createdAt, updatedAt: r.updatedAt, lastUsedAt: r.lastUsedAt, usageCount: r.usageCount || 0, origin: r.origin ? JSON.parse(r.origin) : undefined }));
  }
  const db = loadDB();
  return Object.values(db.snippets || {});
}

function getSnippetByIdOrName(idOrName) {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    let row = db.prepare('SELECT * FROM snippets WHERE id = ?').get(idOrName);
    if (row) return { id: row.id, name: row.name, language: row.language, tags: JSON.parse(row.tags || '[]'), createdAt: row.createdAt, updatedAt: row.updatedAt, lastUsedAt: row.lastUsedAt, usageCount: row.usageCount || 0, content: row.content, path: null };
    row = db.prepare('SELECT * FROM snippets WHERE name = ?').get(idOrName);
    if (row) return { id: row.id, name: row.name, language: row.language, tags: JSON.parse(row.tags || '[]'), createdAt: row.createdAt, updatedAt: row.updatedAt, lastUsedAt: row.lastUsedAt, usageCount: row.usageCount || 0, content: row.content, path: null };
    return null;
  }
  const db = loadDB();
  if (db.snippets[idOrName]) return db.snippets[idOrName];
  const byName = Object.values(db.snippets || {}).find(s => s.name === idOrName);
  return byName || null;
}

function readSnippetContent(snippet) {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    if (!snippet) return '';
    if (snippet.content) return snippet.content;
    // fetch from db by id
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    const row = db.prepare('SELECT content FROM snippets WHERE id = ?').get(snippet.id);
    return row ? row.content : '';
  }
  try { return fs.readFileSync(snippet.path, 'utf8'); } catch (e) { return ''; }
}

function touchUsage(snippet) {
  const cfg = config.loadConfig();
  const now = new Date().toISOString();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    db.prepare('UPDATE snippets SET usageCount = COALESCE(usageCount,0)+1, lastUsedAt = ? WHERE id = ?').run(now, snippet.id);
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  if (!db.snippets[snippet.id]) return;
  db.snippets[snippet.id].usageCount = (db.snippets[snippet.id].usageCount || 0) + 1;
  db.snippets[snippet.id].lastUsedAt = now;
  saveDB(db);
}

function updateSnippetContent(id, content) {
  const cfg = config.loadConfig();
  const now = new Date().toISOString();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    db.prepare('UPDATE snippets SET content = ?, updatedAt = ? WHERE id = ?').run(content, now, id);
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  if (!db.snippets[id]) return;
  const snip = db.snippets[id];
  if (snip.path) fs.writeFileSync(snip.path, content, 'utf8');
  snip.updatedAt = now;
  saveDB(db);
}

function updateSnippetUpdatedAt(id) {
  const cfg = config.loadConfig();
  const now = new Date().toISOString();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    db.prepare('UPDATE snippets SET updatedAt = ? WHERE id = ?').run(now, id);
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  if (!db.snippets[id]) return;
  db.snippets[id].updatedAt = now;
  saveDB(db);
}

function updateSnippetMeta(id, meta) {
  const cfg = config.loadConfig();
  const now = new Date().toISOString();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    if (meta.tags !== undefined) {
      const tagsVal = JSON.stringify(meta.tags);
      db.prepare('UPDATE snippets SET tags = ?, updatedAt = ? WHERE id = ?').run(tagsVal, now, id);
    }
    if (meta.language !== undefined) {
      db.prepare('UPDATE snippets SET language = ?, updatedAt = ? WHERE id = ?').run(meta.language, now, id);
    }
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  if (!db.snippets[id]) return;
  const snip = db.snippets[id];
  if (meta.tags !== undefined) snip.tags = meta.tags;
  if (meta.language !== undefined) snip.language = meta.language;
  snip.updatedAt = now;
  saveDB(db);
}

function deleteSnippetById(id) {
  const cfg = config.loadConfig();
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  const snip = db.snippets[id];
  if (snip && snip.path) {
    try { if (fs.existsSync(snip.path)) fs.unlinkSync(snip.path); } catch (e) { }
  }
  if (db.snippets[id]) delete db.snippets[id];
  saveDB(db);
}

function setSnippetOrigin(id, origin) {
  const cfg = config.loadConfig();
  const val = JSON.stringify(origin || {});
  if (useSqlite(cfg)) {
    const dbFile = cfg.sqlitePath || cfg.dbPath;
    const db = ensureSqlite(dbFile);
    db.prepare('UPDATE snippets SET origin = ? WHERE id = ?').run(val, id);
    if (db._isSqlJs) db.persist();
    return;
  }
  const db = loadDB();
  if (db.snippets && db.snippets[id]) {
    db.snippets[id].origin = origin;
    saveDB(db);
  }
}

module.exports = { loadDB, saveDB, addSnippet, listSnippets, getSnippetByIdOrName, readSnippetContent, touchUsage, updateSnippetContent, updateSnippetUpdatedAt, updateSnippetMeta, deleteSnippetById, setSnippetOrigin };
