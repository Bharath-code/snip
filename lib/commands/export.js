const fs = require('fs');
const storage = require('../storage');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');

function exportCmd(pathArg) {
  try {
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
    log('Exported to', pathArg);
  } catch (e) {
    console.error(c.err('  ✗ Export failed:'), e.message);
    setExitCode(1);
  }
}

module.exports = exportCmd;
