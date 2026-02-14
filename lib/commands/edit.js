const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const config = require('../config');
const { spawnSync } = require('child_process');

function edit(idOrName) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  const content = storage.readSnippetContent(s);
  const editor = (config.loadConfig().editor || process.env.EDITOR || 'vi').split(' ');
  const fileToEdit = s.path || path.join(os.tmpdir(), `snip-edit-${s.id}.tmp`);
  if (!s.path) fs.writeFileSync(fileToEdit, content, 'utf8');
  spawnSync(editor[0], editor.slice(1).concat([fileToEdit]), { stdio: 'inherit' });
  const newContent = fs.readFileSync(fileToEdit, 'utf8');
  if (!s.path) try { fs.unlinkSync(fileToEdit); } catch (e) { }
  if (newContent !== content) {
    storage.updateSnippetContent(s.id, newContent);
    console.log(`Updated "${s.name}"`);
  } else {
    console.log('No changes.');
  }
}

module.exports = edit;
