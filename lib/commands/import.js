const fs = require('fs');
const storage = require('../storage');

function importCmd(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const list = parsed.snippets || parsed;
    list.forEach(s => {
      storage.addSnippet({ name: s.name || 'imported', content: s.content || '', language: s.language, tags: s.tags });
    });
    console.log('Imported', list.length, 'snippets');
  } catch (e) {
    console.error('Import failed', e.message);
  }
}

module.exports = importCmd;
