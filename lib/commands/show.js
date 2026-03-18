const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const { spawnSync } = require('child_process');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint, truncate } = require('../format');
const search = require('../search');

function show(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    // Enhanced error message with suggestions
    console.log('');
    console.log(c.err('  ✗ Snippet not found: ') + c.brand('"' + idOrName + '"'));
    console.log('');
    
    const suggestions = search.suggestSimilar(idOrName, 3);
    if (suggestions.length) {
      console.log(c.muted('  Did you mean?'));
      suggestions.forEach((suggestion, i) => {
        console.log(c.muted('    ') + (i === 0 ? c.brand('→ ') : '  ') + c.brand(suggestion));
      });
      console.log('');
    }
    
    console.log(actionHint([
      'snip list:See all',
      'snip search <query>:Find',
      'snip ui:Interactive',
    ]));
    
    process.exitCode = 1;
    return;
  }
  
  const content = storage.readSnippetContent(s);

  if (opts.json) {
    console.log(JSON.stringify({
      id: s.id, 
      name: s.name, 
      language: s.language,
      tags: s.tags || [], 
      content,
      usageCount: s.usageCount || 0,
      createdAt: s.createdAt, 
      updatedAt: s.updatedAt
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

  // Enhanced display with Claude Code-inspired styling
  console.log('');
  
  // Header line with name and meta
  const langIcon = icons.getLangIcon(s.language);
  const metaParts = [];
  if (s.language) metaParts.push(c.code(langIcon + ' ' + s.language));
  if (s.tags && s.tags.length) metaParts.push(c.tag(icons.tag + ' ' + s.tags.join(', ')));
  if (s.usageCount) metaParts.push(c.dim(icons.usage + ' ' + s.usageCount + ' runs'));
  
  console.log('  ' + c.brand(icons.edit + ' ' + s.name) + c.muted('  ·  ') + metaParts.join(c.muted('  ·  ')));
  console.log(c.dim('  ' + '─'.repeat(Math.min(50, (process.stdout.columns || 80) - 4))));
  console.log('');
  
  // Content with code styling
  if (content) {
    const contentLines = content.split('\n');
    contentLines.forEach(line => {
      console.log(c.code('    ' + line));
    });
  } else {
    console.log(c.muted('    (empty)'));
  }
  
  console.log('');
  
  // Action hints
  console.log(actionHint([
    'r:Run now',
    'c:Copy',
    'e:Edit',
    '/:Search',
    'q:Quit',
  ]));
}

module.exports = show;
