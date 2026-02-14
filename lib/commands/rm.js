const fs = require('fs');
const storage = require('../storage');

function remove(idOrName) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  try { if (fs.existsSync(s.path)) fs.unlinkSync(s.path); } catch (e) {}
  const db = storage.loadDB();
  if (db.snippets && db.snippets[s.id]) {
    delete db.snippets[s.id];
    storage.saveDB(db);
  }
  console.log('Removed', s.id);
}

module.exports = remove;
