const storage = require('../storage');
let chalk = { hex: () => (text) => text };
try {
  const chalkModule = require('chalk');
  chalk = (chalkModule && chalkModule.default) ? chalkModule.default : chalkModule;
} catch (e) {}

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

function list(opts) {
  const items = storage.listSnippets();
  const filtered = items.filter(s => {
    if (opts.tag && (!s.tags || !s.tags.includes(opts.tag))) return false;
    if (opts.lang && s.language !== opts.lang) return false;
    return true;
  });
  const sortBy = normalizeSort(opts.sort);
  filtered.sort(SORTERS[sortBy]);
  if (filtered.length === 0) return console.log('No snippets found.');
  filtered.forEach(s => {
    const name = chalk.hex('#6D28D9')(s.name);
    const tags = (s.tags || []).map(t => chalk.hex('#06B6D4')(t)).join(', ');
    console.log(`${s.id}  ${name}  ${tags}  ${s.usageCount || 0} usages`);
  });
}

module.exports = list;
