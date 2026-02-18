const storage = require('../storage');
let chalk = null;
try {
  const chalkModule = require('chalk');
  chalk = (chalkModule && chalkModule.default) ? chalkModule.default : chalkModule;
} catch (_e) { }

// Helpers — gracefully degrade to plain text when chalk is unavailable
const c = {
  name: (t) => chalk ? chalk.hex('#89B4FA').bold(t) : t,
  tag: (t) => chalk ? chalk.hex('#94E2D5')(t) : t,
  muted: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
  badge: (t) => chalk ? chalk.hex('#F5C2E7')(t) : t,
  dim: (t) => chalk ? chalk.dim(t) : t,
};

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

  // JSON output for scripting
  if (opts.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  if (filtered.length === 0) return console.log(c.muted('No snippets found.'));

  // Column widths
  const nameW = 28;
  const langW = 10;
  const tagsW = 30;
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
}

module.exports = list;

