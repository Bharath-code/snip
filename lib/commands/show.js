const storage = require('../storage');
const { spawnSync } = require('child_process');

function show(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  const content = storage.readSnippetContent(s);
  if (opts.edit) {
    const editor = (require('../config').loadConfig().editor || 'vi').split(' ');
    const tmp = s.path;
    spawnSync(editor[0], editor.slice(1).concat([tmp]), { stdio: 'inherit' });
    return;
  }
  console.log('--- ' + s.name + ' ---');
  console.log(content);
}

module.exports = show;
