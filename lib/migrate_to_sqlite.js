#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const config = require('./config');
const storage = require('./storage');

async function migrate() {
  const cfg = config.loadConfig();
  const dbFile = cfg.sqlitePath || cfg.dbPath;
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbFile);
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
    const items = storage.listSnippets();
    const insert = db.prepare('INSERT OR REPLACE INTO snippets (id,name,content,language,tags,createdAt,updatedAt,lastUsedAt,usageCount,origin) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let count = 0;
    for (const s of items) {
      const content = storage.readSnippetContent(s);
      insert.run(s.id, s.name, content, s.language || '', JSON.stringify(s.tags||[]), s.createdAt, s.updatedAt, s.lastUsedAt, s.usageCount||0, JSON.stringify(s.origin||{}));
      count++;
    }
    console.log('Migrated', count, 'snippets to', dbFile);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

if (require.main === module) migrate();

module.exports = migrate;
