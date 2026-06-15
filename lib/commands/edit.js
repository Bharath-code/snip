const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const config = require('../config');
const { spawnSync } = require('child_process');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');
const icons = require('../icons');

function edit(idOrName) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(c.err(`  ${icons.cross} Snippet not found: `) + c.brand(`"${idOrName}"`));
    setExitCode(1);
    return;
  }
  const content = storage.readSnippetContent(s);
  const editor = (config.loadConfig().editor || process.env.EDITOR || 'vi').split(' ');
  const fileToEdit = s.path || path.join(os.tmpdir(), `snip-edit-${s.id}.tmp`);
  if (!s.path) fs.writeFileSync(fileToEdit, content, 'utf8');
  spawnSync(editor[0], editor.slice(1).concat([fileToEdit]), { stdio: 'inherit' });
  const newContent = fs.readFileSync(fileToEdit, 'utf8');
  if (!s.path) try { fs.unlinkSync(fileToEdit); } catch (_e) { }
  if (newContent !== content) {
    storage.updateSnippetContent(s.id, newContent);
    log(`Updated "${s.name}"`);
  } else {
    log('No changes.');
  }
}

module.exports = edit;
