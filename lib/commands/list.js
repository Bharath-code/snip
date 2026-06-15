const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint, stripAnsi } = require('../format');
const { log } = require('../quiet');
const streak = require('../streak');

const SORTERS = {
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  usage: (a, b) => {
    const diff = (b.usageCount || 0) - (a.usageCount || 0);
    if (diff !== 0) return diff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  },
  recent: (a, b) => {
    const aTs = Date.parse(a.lastUsedAt || a.updatedAt || a.createdAt || 0) || 0;
    const bTs = Date.parse(b.lastUsedAt || b.updatedAt || b.createdAt || 0) || 0;
    if (bTs !== aTs) return bTs - aTs;
    return String(a.name || '').localeCompare(String(b.name || ''));
  }
};

function normalizeSort(sort) {
  const key = String(sort || 'name').trim().toLowerCase();
  return SORTERS[key] ? key : 'name';
}

// F5: Language alias normalization for filter
const LANG_ALIASES = {
  js: 'javascript', javascript: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python', python: 'python',
  rb: 'ruby', ruby: 'ruby',
  sh: 'sh', bash: 'bash', zsh: 'zsh',
};
function normalizeLang(l) {
  const k = String(l || '').toLowerCase();
  return LANG_ALIASES[k] || k;
}

function list(opts) {
  const items = storage.listSnippets();
  const filtered = items.filter(s => {
    if (opts.tag && (!s.tags || !s.tags.includes(opts.tag))) return false;
    // F5: Normalize language aliases so --lang js matches snippets saved as javascript
    if (opts.lang) {
      const filterLang = normalizeLang(opts.lang);
      const snippetLang = normalizeLang(s.language);
      if (filterLang !== snippetLang) return false;
    }
    return true;
  });
  const sortBy = normalizeSort(opts.sort);
  filtered.sort(SORTERS[sortBy]);

  // Limit results if requested
  if (opts.limit) {
    const max = Math.max(1, Math.min(parseInt(opts.limit) || filtered.length, 500));
    filtered.splice(max);
  }

  // JSON output for scripting
  if (opts.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  if (filtered.length === 0) {
    log('');
    log(c.muted('  No snippets found yet.'));
    log('');
    log(formatList([
      { text: 'snip seed', style: c.brand } + c.muted('  - Add example snippets'),
      { text: 'snip init', style: c.brand } + c.muted('  - Guided setup'),
      { text: 'echo "cmd" | snip add <name>', style: c.brand } + c.muted('  - Add from pipe'),
    ], { indent: 1 }));
    return;
  }

  // Get streak for header
  const { streak: streakDays } = streak.getStreak();
  
  // Column widths — respect terminal width (defaults if not a TTY)
  const cols = (process.stdout.columns && process.stdout.isTTY) ? Math.max(60, process.stdout.columns) : 80;
  const nameW = Math.min(28, Math.floor(cols * 0.28));
  const langW = 10;
  const tagsW = Math.min(26, Math.floor(cols * 0.26));
  const usageW = 6;

  // ── Section header with box drawing ──
  console.log('');
  const filterInfo = [];
  if (opts.tag) filterInfo.push(c.tag(icons.tag + ' ' + opts.tag));
  if (opts.lang) filterInfo.push(c.code(icons.getLangIcon(opts.lang) + ' ' + opts.lang));
  
  const headerParts = [
    c.brand(icons.dot + ' Your Snippets'),
  ];
  if (streakDays > 0) {
    headerParts.push(c.fire(icons.fire + ' ' + streakDays));
  }
  if (filterInfo.length > 0) {
    headerParts.push(...filterInfo);
  }

  // Draw top border
  const boxWidth = nameW + langW + tagsW + usageW + 8;
  log(c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐'));
  
  // Header line
  const headerStr = ' ' + headerParts.join('  ');
  const headerPadding = Math.max(0, boxWidth - 2 - stripAnsi(headerStr).length - 1);
  log(c.border('  │') + headerStr + ' '.repeat(headerPadding) + c.border('│'));
  
  // Column headers
  log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
  const colHeader = 
    c.dim(icons.run).padEnd(3) + c.dim('Name'.padEnd(nameW)) + 
    c.dim('Lang'.padEnd(langW + 1)) + 
    c.dim('Tags'.padEnd(tagsW + 1)) + 
    c.dim('Runs'.padStart(usageW));
  const colPadding = Math.max(0, boxWidth - 2 - stripAnsi(colHeader).length - 1);
  log(c.border('  │') + ' ' + colHeader + ' '.repeat(colPadding) + c.border('│'));

  // Rows — these are data output, always show
  filtered.forEach((s) => {
    const rawName = String(s.name || 'untitled');
    const truncName = rawName.length > nameW - 2 ? rawName.slice(0, nameW - 3) + '...' : rawName;
    
    // Workspace badge for team snippets
    const workspaceTag = (s.tags || []).find(t => t.startsWith('workspace:'));
    const workspaceBadge = workspaceTag
      ? c.info(' ' + workspaceTag.split(':')[1].slice(0, 6)) + c.dim('│') + ' '
      : '';
    const name = c.name(truncName.padEnd(nameW));
    
    const langIcon = icons.getLangIcon(s.language);
    const lang = s.language 
      ? c.muted(langIcon + ' ' + (s.language || '').padEnd(langW - 2))
      : c.muted('—'.padEnd(langW));
    
    const rawTags = (s.tags || []).join(', ');
    const truncTags = rawTags.length > tagsW - 2 ? rawTags.slice(0, tagsW - 3) + '...' : rawTags;
    const tags = (s.tags || []).length
      ? c.tag(truncTags.padEnd(tagsW))
      : c.muted('—'.padEnd(tagsW));
    
    const usage = s.usageCount
      ? c.badge(String(s.usageCount).padStart(usageW))
      : c.muted('—'.padStart(usageW));
    
    // Build row content
    const rowContent = ` ${icons.run} ${workspaceBadge}${name} ${lang} ${tags} ${usage}`;
    const rowLen = stripAnsi(rowContent).length;
    const rowPadding = Math.max(0, boxWidth - 2 - rowLen - 1);
    console.log(c.border('  │') + rowContent + ' '.repeat(rowPadding) + c.border('│'));
  });

  // Bottom border
  log(c.border('  └' + '─'.repeat(boxWidth - 2) + '┘'));

  // Summary footer
  log('');
  const totalStr = filtered.length === 1 ? '1 snippet' : `${filtered.length} snippets` + 
    (filtered.length >= 50 ? ` (${items.length} total)` : '');
  log(c.muted('  ' + totalStr));
  
  // Action hints
  if (process.stdout.isTTY) {
    log(actionHint([
      'snip search <query>:Find',
      'snip ui:Open TUI',
      'snip add <name>:Create',
    ]));
  }
  
  // Filter clear hint
  if (opts.tag || opts.lang) {
    log(c.muted('\n  Tip: Clear filters with ') + c.brand('snip list'));
  }
}

module.exports = list;
