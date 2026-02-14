const fs = require('fs');
const storage = require('../storage');

function exportCmd(pathArg) {
  const items = storage.listSnippets().map(s => ({
    id: s.id,
    name: s.name,
    language: s.language,
    tags: s.tags,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    content: storage.readSnippetContent(s)
  }));
  const out = JSON.stringify({ exportedAt: new Date().toISOString(), snippets: items }, null, 2);
  if (!pathArg) {
    console.log(out);
    return;
  }
  fs.writeFileSync(pathArg, out, 'utf8');
  console.log('Exported to', pathArg);
}

module.exports = exportCmd;
