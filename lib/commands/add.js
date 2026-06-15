const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const storage = require('../storage');
const config = require('../config');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint, stripAnsi } = require('../format');
const { log } = require('../quiet');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function add(name, opts) {
  const cfg = config.loadConfig();
  let content = '';
  if (!process.stdin.isTTY) {
    content = await readStdin();
  } else {
    const tmp = path.join(os.tmpdir(), `snip-${Date.now()}.tmp`);
    fs.writeFileSync(tmp, `# Snippet: ${name}\n\n`);
    const editor = cfg.editor.split(' ');
    spawnSync(editor[0], editor.slice(1).concat([tmp]), { stdio: 'inherit' });
    content = fs.readFileSync(tmp, 'utf8');
    fs.unlinkSync(tmp);
  }
  
  // Auto-detect context for smart tagging (shared with MCP handleSave)
  const userTags = opts.tags ? opts.tags.split(',').map(t => t.trim()) : [];
  const { autoTagSnippet } = require('../command-utils');
  const { allTags } = autoTagSnippet(userTags);
  const snippet = storage.addSnippet({ name, content, language: opts.lang, tags: allTags });
  
  // ── Enhanced success message with boxed layout ──
  const cols = Math.min(process.stdout.columns || 80, 72);
  const boxWidth = cols;
  
  log('');
  log(c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐'));
  
  const langIcon = icons.getLangIcon(snippet.language);
  const metaParts = [];
  if (snippet.language) metaParts.push(c.code(langIcon + ' ' + snippet.language));
  if (snippet.tags && snippet.tags.length) metaParts.push(c.tag(icons.tag + ' ' + snippet.tags.join(', ')));
  
  const headerStr = ' ' + c.success(icons.check + ' Created: ') + c.brand(snippet.name);
  const headerPadding = Math.max(0, boxWidth - 2 - stripAnsi(headerStr).length - 1);
  log(c.border('  │') + headerStr + ' '.repeat(headerPadding) + c.border('│'));
  
  if (metaParts.length) {
    const metaStr = '  ' + metaParts.join(c.muted('  ·  '));
    const metaPadding = Math.max(0, boxWidth - 2 - stripAnsi(metaStr).length - 1);
    log(c.border('  │') + metaStr + ' '.repeat(metaPadding) + c.border('│'));
  }
  
  // Separator + content preview
  if (content) {
    log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
    
    const previewLines = content.split('\n').slice(0, 4);
    previewLines.forEach(line => {
      const safeLine = line || '';
      const displayLine = ' ' + c.code(safeLine);
      const linePadding = Math.max(0, boxWidth - 2 - stripAnsi(displayLine).length - 1);
      log(c.border('  │') + displayLine + ' '.repeat(linePadding) + c.border('│'));
    });
    
    if (content.split('\n').length > 4) {
      const truncLine = c.muted('  ... (' + content.split('\n').length + ' lines total)');
      const truncPadding = Math.max(0, boxWidth - 2 - stripAnsi(truncLine).length - 1);
      log(c.border('  │') + truncLine + ' '.repeat(truncPadding) + c.border('│'));
    }
  }
  
  log(c.border('  └' + '─'.repeat(boxWidth - 2) + '┘'));
  log('');
  
  // Action hints
  log(actionHint([
    'snip run ' + name + ':Run',
    'snip exec ' + name + ':Execute',
    'snip show ' + name + ':View',
  ]));
}

module.exports = add;
