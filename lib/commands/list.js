const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { section, list: formatList, truncate, relativeTime, actionHint, stripAnsi } = require('../format');
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
    console.log('');
    console.log(c.muted('  No snippets found yet.'));
    console.log('');
    console.log(formatList([
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
  const nameW = Math.min(30, Math.floor(cols * 0.30));
  const langW = 12;
  const tagsW = Math.min(28, Math.floor(cols * 0.28));
  const usageW = 8;

  // Header with stats
  console.log('');
  const filterInfo = [];
  if (opts.tag) filterInfo.push(c.tag('🏷 ' + opts.tag));
  if (opts.lang) filterInfo.push(c.code(icons.getLangIcon(opts.lang) + ' ' + opts.lang));
  
  const headerParts = [
    c.brand(icons.dot + ' Your Snippets'),
  ];
  if (streakDays > 0) {
    headerParts.push(c.fire + ' ' + streakDays);
  }
  if (filterInfo.length > 0) {
    headerParts.push(c.muted('·'), ...filterInfo);
  } else {
    headerParts.push(c.muted('·'), c.muted(icons.folder + ' All'));
  }
  
  console.log('  ' + headerParts.join('  '));
  console.log(c.dim('  ' + '─'.repeat(Math.min(50, cols - 4))));
  console.log('');

  // Table header
  const headerFormat = c.dim('  ') + 
    icons.run.padEnd(nameW) + 
    c.dim(icons.language.padEnd(langW)) + 
    c.dim(icons.tag.padEnd(tagsW)) + 
    c.dim(icons.usage.padStart(usageW));
  console.log(headerFormat);
  console.log(c.dim('  ' + '─'.repeat(nameW + langW + tagsW + usageW)));

  // Rows
  filtered.forEach(s => {
    // Truncate with ellipsis
    const rawName = String(s.name || 'untitled');
    const truncName = rawName.length > nameW - 2 ? rawName.slice(0, nameW - 3) + '…' : rawName;
    const name = c.name(icons.run + ' ' + truncName.padEnd(nameW - 2));
    
    // Language with icon
    const langIcon = icons.getLangIcon(s.language);
    const lang = s.language 
      ? c.muted(langIcon + ' ' + (s.language || '').padEnd(langW - 2))
      : c.muted('—'.padEnd(langW));
    
    // Tags
    const rawTags = (s.tags || []).join(', ');
    const truncTags = rawTags.length > tagsW - 2 ? rawTags.slice(0, tagsW - 3) + '…' : rawTags;
    const tags = (s.tags || []).length
      ? c.tag(truncTags.padEnd(tagsW))
      : c.muted('—'.padEnd(tagsW));
    
    // Usage count
    const usage = s.usageCount
      ? c.badge(String(s.usageCount).padStart(usageW - 1) + ' ' + icons.usage)
      : c.muted('0'.padStart(usageW));
    
    console.log(`  ${name}${lang}${tags}${usage}`);
  });

  // Summary footer
  console.log('');
  console.log(c.muted(`  ${filtered.length} snippet${filtered.length === 1 ? '' : 's'}` + 
    (filtered.length >= 50 && process.stdout.isTTY ? ' · showing ' + filtered.length + ' of ' + items.length : '')));
  
  // Action hints
  if (process.stdout.isTTY) {
    console.log(actionHint([
      'snip search <query>:Find',
      'snip ui:Open TUI',
      'snip add <name>:Create',
    ]));
  }
  
  // Filter clear hint
  if (opts.tag || opts.lang) {
    console.log(c.muted('\n  Tip: Clear filters with ') + c.brand('snip list'));
  }
}

module.exports = list;
