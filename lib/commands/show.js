const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const { spawnSync } = require('child_process');

function show(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  const content = storage.readSnippetContent(s);

  if (opts.json) {
    console.log(JSON.stringify({
      id: s.id, name: s.name, language: s.language,
      tags: s.tags || [], content,
      usageCount: s.usageCount || 0,
      createdAt: s.createdAt, updatedAt: s.updatedAt
    }, null, 2));
    return;
  }

  if (opts.raw) {
    process.stdout.write(content || '');
    return;
  }

  if (opts.edit) {
    const editor = (require('../config').loadConfig().editor || 'vi').split(' ');
    const fileToEdit = s.path || path.join(os.tmpdir(), `snip-show-${s.id}.tmp`);
    if (!s.path) fs.writeFileSync(fileToEdit, content, 'utf8');
    spawnSync(editor[0], editor.slice(1).concat([fileToEdit]), { stdio: 'inherit' });
    if (!s.path) {
      const newContent = fs.readFileSync(fileToEdit, 'utf8');
      fs.unlinkSync(fileToEdit);
      storage.updateSnippetContent(s.id, newContent);
    } else {
      storage.updateSnippetUpdatedAt(s.id);
    }
    return;
  }
  console.log('--- ' + s.name + ' ---');
  console.log(content);
}

module.exports = show;
