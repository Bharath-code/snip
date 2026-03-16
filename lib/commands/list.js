const storage = require('../storage');
const { c } = require('../colors');

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
    console.log(c.muted('No snippets found.'));
    console.log(c.dim('  Run:'));
    console.log(c.dim('    • snip seed               # Add example snippets'));
    console.log(c.dim('    • snip init               # Guided setup'));
    console.log(c.dim('    • echo "cmd" | snip add   # Add from pipe'));
    return;
  }

  // Column widths — respect terminal width (defaults if not a TTY)
  const cols = (process.stdout.columns && process.stdout.isTTY) ? Math.max(60, process.stdout.columns) : 80;
  const nameW = Math.min(28, Math.floor(cols * 0.28));
  const langW = 10;
  const tagsW = Math.min(30, Math.floor(cols * 0.32));
  const usageW = 6;

  // Header
  console.log(
    c.dim('  ' +
      'NAME'.padEnd(nameW) +
      'LANG'.padEnd(langW) +
      'TAGS'.padEnd(tagsW) +
      'USED'.padStart(usageW))
  );
  console.log(c.dim('  ' + '─'.repeat(nameW + langW + tagsW + usageW)));

  // Rows
  filtered.forEach(s => {
    // U3: Truncate with ellipsis instead of silent cutoff
    const rawName = String(s.name || 'untitled');
    const truncName = rawName.length > nameW - 2 ? rawName.slice(0, nameW - 3) + '…' : rawName;
    const name = c.name(truncName.padEnd(nameW));
    const lang = c.muted((s.language || '–').padEnd(langW));
    const rawTags = (s.tags || []).join(', ');
    const truncTags = rawTags.length > tagsW - 2 ? rawTags.slice(0, tagsW - 3) + '…' : rawTags;
    const tags = (s.tags || []).length
      ? c.tag(truncTags.padEnd(tagsW))
      : c.muted('–'.padEnd(tagsW));
    const usage = s.usageCount
      ? c.badge(String(s.usageCount).padStart(usageW))
      : c.muted('0'.padStart(usageW));
    console.log(`  ${name}${lang}${tags}${usage}`);
  });

  console.log(c.dim(`\n  ${filtered.length} snippet${filtered.length === 1 ? '' : 's'}`));
  if (filtered.length >= 50 && process.stdout.isTTY) {
    console.log(c.dim('  Tip:') + c.dim(` snip ui               # Interactive browser`));
    console.log(c.dim('       snip search <query>  # Fuzzy search'));
    console.log(c.dim('       --limit <n>          # Cap results'));
  }
  if (opts.tag || opts.lang) {
    console.log(c.dim('  Tip:') + c.dim(` Clear filters with: snip list`));
  }
}

module.exports = list;

