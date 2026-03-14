const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const { spawnSync } = require('child_process');
const { c } = require('../colors');
const search = require('../search');

function show(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(`Snippet not found: "${idOrName}"`);
    const suggestions = search.suggestSimilar(idOrName, 3);
    if (suggestions.length) console.error(`  Did you mean: ${suggestions.join(', ')}? Try: snip search "${idOrName}"`);
    process.exitCode = 1;
    return;
  }
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
    const result = spawnSync(editor[0], editor.slice(1).concat([fileToEdit]), { stdio: 'inherit' });
    if (!s.path) {
      if (result.status === 0) {
        const newContent = fs.readFileSync(fileToEdit, 'utf8');
        storage.updateSnippetContent(s.id, newContent);
      }
      try { fs.unlinkSync(fileToEdit); } catch (_) { }
    } else if (result.status === 0) {
      storage.updateSnippetUpdatedAt(s.id);
    }
    return;
  }

  console.log(c.accent(`\n  ─── ${s.name} ───`));
  const meta = [];
  if (s.language) meta.push(s.language);
  if (s.tags && s.tags.length) meta.push(`tags: ${s.tags.join(', ')}`);
  if (s.usageCount) meta.push(`used: ${s.usageCount}×`);
  if (meta.length) console.log(c.dim(`  ${meta.join(' · ')}`));
  console.log('');
  console.log(content);
}

module.exports = show;
