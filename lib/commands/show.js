const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../storage');
const { spawnSync } = require('child_process');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint, stripAnsi, box, messageBox } = require('../format');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');
const versions = require('../versions');
const search = require('../search');

function getVersionContent(s, opts) {
  if (opts.rev === undefined || opts.rev === null) return null;
  const v = String(opts.rev).toLowerCase();
  if (v === 'latest') {
    const allVersions = versions.listVersions(s.id);
    if (allVersions.length > 0) {
      const latest = allVersions[allVersions.length - 1];
      return { content: versions.getVersionContent(s.id, latest.version), label: `v${latest.version}` };
    }
    return null;
  }
  const ver = parseInt(v);
  if (!isNaN(ver)) {
    return { content: versions.getVersionContent(s.id, ver), label: `v${ver}` };
  }
  return null;
}

function show(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    log('');
    console.error(c.err('  ' + icons.cross + ' Snippet not found: ') + c.brand('"' + idOrName + '"'));
    log('');
    
    const suggestions = search.suggestSimilar(idOrName, 3);
    if (suggestions.length) {
      const suggestionLines = suggestions.map((sugg, i) => 
        (i === 0 ? c.brand('→ ') : '  ') + c.brand(sugg)
      );
      log(box(
        '  Did you mean?\n' + suggestionLines.join('\n'),
        { title: 'Suggestions', borderColor: c.muted, titleColor: c.info }
      ));
      log('');
    }
    
    log(actionHint([
      'snip list:See all',
      'snip search <query>:Find',
      'snip ui:Interactive',
    ]));
    
    setExitCode(1);
    return;
  }

  // Check for --rev flag to view old versions
  const versioned = getVersionContent(s, opts);
  const content = versioned ? versioned.content : storage.readSnippetContent(s);
  const versionLabel = versioned ? ` @${versioned.label}` : '';

  if (opts.json) {
    console.log(JSON.stringify({
      id: s.id, 
      name: s.name, 
      language: s.language,
      tags: s.tags || [], 
      content,
      version: versioned ? versioned.label : 'current',
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
    if (versioned) {
      // Editing a historical version — save as current first
      storage.updateSnippetContent(s.id, content);
    }
    const editor = (require('../config').loadConfig().editor || 'vi').split(' ');
    const fileToEdit = s.path || path.join(os.tmpdir(), `snip-show-${s.id}.tmp`);
    if (!s.path) fs.writeFileSync(fileToEdit, content, 'utf8');
    const result = spawnSync(editor[0], editor.slice(1).concat([fileToEdit]), { stdio: 'inherit' });
    if (!s.path) {
      if (result.status === 0) {
        const newContent = fs.readFileSync(fileToEdit, 'utf8');
        storage.updateSnippetContent(s.id, newContent);
      }
      try { fs.unlinkSync(fileToEdit); } catch { }
    } else if (result.status === 0) {
      storage.updateSnippetUpdatedAt(s.id);
    }
    return;
  }

  // ── Enhanced display with boxed layout ──
  const cols = Math.min(process.stdout.columns || 80, 72);
  const boxWidth = cols;
  
  log('');
  
  // Top border
  log(c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐'));
  
  // Header: name + metadata
  const langIcon = icons.getLangIcon(s.language);
  const metaParts = [];
  if (s.language) metaParts.push(c.code(langIcon + ' ' + s.language));
  if (versionLabel) metaParts.push(c.muted(versionLabel));
  if (s.tags && s.tags.length) metaParts.push(c.tag(icons.tag + ' ' + s.tags.join(', ')));
  if (s.usageCount) metaParts.push(c.dim(icons.usage + ' ' + s.usageCount + ' runs'));
  
  const headerStr = ' ' + c.brand(icons.edit + ' ' + s.name) + (metaParts.length ? c.muted('  ·  ') + metaParts.join(c.muted('  ·  ')) : '');
  const headerPadding = Math.max(0, boxWidth - 2 - stripAnsi(headerStr).length - 1);
  log(c.border('  │') + headerStr + ' '.repeat(headerPadding) + c.border('│'));
  
  // Created/updated info
  const timeParts = [];
  if (s.createdAt) timeParts.push('created ' + new Date(s.createdAt).toLocaleDateString());
  if (s.updatedAt) timeParts.push('updated ' + new Date(s.updatedAt).toLocaleDateString());
  if (timeParts.length) {
    const timeStr = c.muted('  ' + timeParts.join(', '));
    const timePadding = Math.max(0, boxWidth - 2 - stripAnsi(timeStr).length - 1);
    log(c.border('  │') + timeStr + ' '.repeat(timePadding) + c.border('│'));
  }
  
  // Separator
  log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
  
  // Version info banner if viewing old version
  if (versioned) {
    const verStr = c.warn(`  ⚠ Viewing ${versioned.label} (snapshot from history)`);
    const verPadding = Math.max(0, boxWidth - 2 - stripAnsi(verStr).length - 1);
    log(c.border('  │') + verStr + ' '.repeat(verPadding) + c.border('│'));
    log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
  }
  
  // Content with line numbers
  if (content) {
    const contentLines = content.split('\n');
    const lineNumPad = String(contentLines.length).length;
    
    contentLines.forEach((line, i) => {
      const lineNum = c.dim(String(i + 1).padStart(lineNumPad) + ' ' + icons.bar);
      const safeLine = line || '';
      const displayLine = ' ' + lineNum + ' ' + c.code(safeLine);
      const lineLen = stripAnsi(displayLine).length;
      const linePadding = Math.max(0, boxWidth - 2 - lineLen - 1);
      console.log(c.border('  │') + displayLine + ' '.repeat(linePadding) + c.border('│'));
    });
  } else {
    const emptyLine = c.muted('  (empty)');
    const emptyPadding = Math.max(0, boxWidth - 2 - stripAnsi(emptyLine).length - 1);
    log(c.border('  │') + emptyLine + ' '.repeat(emptyPadding) + c.border('│'));
  }
  
  // Bottom border
  log(c.border('  └' + '─'.repeat(boxWidth - 2) + '┘'));
  log('');
  
  // Action hints
  if (versioned) {
    log(actionHint([
      `snip history ${s.name}:View all versions`,
      `snip undo ${s.name}:Rollback`,
      `snip diff ${s.name} prev ${versioned.label}:Diff vs current`,
    ]));
  } else {
    log(actionHint([
      'snip run ' + s.name + ':Run now',
      'snip exec ' + s.name + ':Execute',
      'snip edit ' + s.name + ':Edit',
      'snip history ' + s.name + ':History',
    ]));
  }
}

module.exports = show;
