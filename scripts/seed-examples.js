#!/usr/bin/env node
/**
 * Clear all snippet data (JSON + SQLite) and populate with 10 examples.
 * Usage: node scripts/seed-examples.js   or  snip seed
 */
const path = require('path');
const fs = require('fs');
const config = require('../lib/config');
const storage = require('../lib/storage');

function useSqlite(cfg) {
  return cfg.useSqlite || (cfg.dbPath && (cfg.dbPath.endsWith('.sqlite') || cfg.dbPath.endsWith('.db')));
}

function tryRequireSqlite() {
  try { return require('better-sqlite3'); } catch (e) { return null; }
}
function tryRequireSqlJs() {
  try { return require('sql.js'); } catch (e) { return null; }
}

function ensureSqlite(dbPath) {
  const Better = tryRequireSqlite();
  if (Better) {
    const db = new Better(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS snippets (id TEXT PRIMARY KEY, name TEXT, content TEXT, language TEXT, tags TEXT, createdAt TEXT, updatedAt TEXT, lastUsedAt TEXT, usageCount INTEGER DEFAULT 0, origin TEXT)');
    return db;
  }
  const sqljs = tryRequireSqlJs();
  if (!sqljs) return null;
  const SQL = sqljs.Database || (sqljs.default && sqljs.default.Database);
  let dbInstance;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    dbInstance = new SQL(new Uint8Array(buf));
  } else dbInstance = new SQL();
  dbInstance.run('CREATE TABLE IF NOT EXISTS snippets (id TEXT PRIMARY KEY, name TEXT, content TEXT, language TEXT, tags TEXT, createdAt TEXT, updatedAt TEXT, lastUsedAt TEXT, usageCount INTEGER DEFAULT 0, origin TEXT)');
  const adapter = {
    _isSqlJs: true,
    _db: dbInstance,
    _filePath: dbPath,
    prepare: (sql) => ({
      run: function (...params) {
        const stmt = dbInstance.prepare(sql);
        if (params && params.length) stmt.bind(params);
        stmt.run();
        stmt.free();
      }
    }),
    persist: function () {
      try {
        fs.writeFileSync(dbPath, Buffer.from(dbInstance.export()));
      } catch (e) { console.warn('sql.js persist:', e.message); }
    }
  };
  return adapter;
}

function clearJsonBackend(cfg) {
  const dbPath = cfg.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify({ snippets: {} }, null, 2));
  const dataDir = cfg.dataDir || dir;
  const snippetsDir = path.join(dataDir, 'snippets');
  if (fs.existsSync(snippetsDir)) {
    fs.readdirSync(snippetsDir).forEach(f => {
      try { fs.unlinkSync(path.join(snippetsDir, f)); } catch (e) {}
    });
  }
}

function clearSqliteBackend(dbFile) {
  if (!fs.existsSync(dbFile)) return;
  const db = ensureSqlite(dbFile);
  if (!db) return;
  db.prepare('DELETE FROM snippets').run();
  if (db._isSqlJs && db.persist) db.persist();
}

const EXAMPLES = [
  { name: 'git-clean-merged', content: 'git branch --merged main | egrep -v "(^\\*|main|master)" | xargs -r git branch -d', language: 'sh', tags: ['git', 'cleanup'] },
  { name: 'docker-run-shell', content: 'docker run --rm -it --network host -v "$PWD":/work -w /work ubuntu:24.04 bash', language: 'sh', tags: ['docker', 'run'] },
  { name: 'serve-dir-http', content: 'python3 -m http.server 8000', language: 'sh', tags: ['http', 'dev'] },
  { name: 'docker-run-workdir', content: 'docker run --rm -it -v "$PWD":/work -w /work ubuntu:24.04 bash', language: 'sh', tags: ['docker', 'run'] },
  { name: 'npm-audit-fix', content: 'npm audit fix', language: 'sh', tags: ['npm', 'security'] },
  { name: 'git-status-short', content: 'git status -sb', language: 'sh', tags: ['git'] },
  { name: 'json-pretty', content: 'cat file.json | python3 -m json.tool', language: 'sh', tags: ['json', 'util'] },
  { name: 'local-ip', content: "hostname -I | awk '{print $1}'", language: 'sh', tags: ['network', 'util'] },
  { name: 'kill-port', content: 'lsof -ti :PORT | xargs kill -9', language: 'sh', tags: ['util', 'port'] },
  { name: 'hello-world', content: "echo 'Hello from snip!'", language: 'sh', tags: ['demo'] }
];

function main() {
  const cfg = config.loadConfig();
  console.log('Clearing local (JSON) and SQLite data...');

  clearJsonBackend(cfg);

  if (cfg.sqlitePath) clearSqliteBackend(cfg.sqlitePath);
  if (cfg.dbPath && (cfg.dbPath.endsWith('.db') || cfg.dbPath.endsWith('.sqlite')) && cfg.dbPath !== cfg.sqlitePath)
    clearSqliteBackend(cfg.dbPath);

  console.log('Adding 10 example snippets...');
  EXAMPLES.forEach((ex, i) => {
    storage.addSnippet(ex);
    console.log(`  ${i + 1}. ${ex.name}`);
  });
  console.log('Done. Run `snip list` or `snip ui` to see them.');
}

if (require.main === module) main();
module.exports = { main };
