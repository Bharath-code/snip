const storage = require('../storage');
const config = require('../config');
const { spawnSync } = require('child_process');

function edit(idOrName) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  const editor = (config.loadConfig().editor || 'vi').split(' ');
  spawnSync(editor[0], editor.slice(1).concat([s.path]), { stdio: 'inherit' });
  const db = storage.loadDB();
  if (db.snippets && db.snippets[s.id]) {
    db.snippets[s.id].updatedAt = new Date().toISOString();
    storage.saveDB(db);
  }
  console.log('Updated', s.id);
}

module.exports = edit;
