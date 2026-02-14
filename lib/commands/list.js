const storage = require('../storage');
const chalkModule = require('chalk');
const chalk = (chalkModule && chalkModule.default) ? chalkModule.default : chalkModule;

function list(opts) {
  const items = storage.listSnippets();
  const filtered = items.filter(s => {
    if (opts.tag && (!s.tags || !s.tags.includes(opts.tag))) return false;
    if (opts.lang && s.language !== opts.lang) return false;
    return true;
  });
  if (filtered.length === 0) return console.log('No snippets found.');
  filtered.forEach(s => {
    const name = chalk.hex('#6D28D9')(s.name);
    const tags = (s.tags || []).map(t => chalk.hex('#06B6D4')(t)).join(', ');
    console.log(`${s.id}  ${name}  ${tags}  ${s.usageCount || 0} usages`);
  });
}

module.exports = list;
