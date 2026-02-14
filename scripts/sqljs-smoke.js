const fs = require('fs');
const path = require('path');
let SQLLib = require('sql.js');

(async function(){
  try {
    // normalize sql.js API across versions
    let SQL;
    if (SQLLib && SQLLib.Database) SQL = SQLLib;
    else if (SQLLib && SQLLib.default && SQLLib.default.Database) SQL = SQLLib.default;
    else if (typeof SQLLib === 'function') {
      // older versions export initSqlJs factory
      const maybe = await SQLLib();
      SQL = maybe && (maybe.Database ? maybe : (maybe.default && maybe.default.Database ? maybe.default : null));
    } else if (SQLLib && SQLLib.initSqlJs) {
      const maybe = await SQLLib.initSqlJs();
      SQL = maybe && (maybe.Database ? maybe : (maybe.default && maybe.default.Database ? maybe.default : null));
    }
    if (!SQL || !SQL.Database) throw new Error('sql.js Database not available');

    const dbFile = path.join(__dirname, '..', 'temp-sqljs.db');
    // create DB and insert a row
    const db = new SQL.Database();
    db.run('CREATE TABLE snippets (id TEXT PRIMARY KEY, name TEXT, content TEXT)');
    db.run('INSERT INTO snippets VALUES (?,?,?)', ['s1', 'smoke', 'hello']);
    const bytes = db.export();
    fs.writeFileSync(dbFile, Buffer.from(bytes));

    // load back and verify
    const buf = fs.readFileSync(dbFile);
    const db2 = new SQL.Database(new Uint8Array(buf));
    const res = db2.exec("SELECT name,content FROM snippets WHERE id = 's1'");
    if (!res || !res[0] || !res[0].values || res[0].values.length !== 1) {
      console.error('sql.js smoke test failed: no row');
      process.exit(2);
    }
    const [name, content] = res[0].values[0];
    if (name !== 'smoke' || content !== 'hello') {
      console.error('sql.js smoke test failed: unexpected values', res);
      process.exit(3);
    }
    console.log('sql.js smoke OK');
    process.exit(0);
  } catch (e) {
    console.error('sql.js smoke error:', e && e.message);
    process.exit(4);
  }
})();
