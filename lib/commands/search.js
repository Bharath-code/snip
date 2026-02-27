const search = require('../search');
const storage = require('../storage');

// UX: Colored output (graceful fallback)
let chalk = null;
try {
  const m = require('chalk');
  chalk = (m && m.default) ? m.default : m;
} catch (_) { }
const c = {
  name: (t) => chalk ? chalk.hex('#89B4FA').bold(t) : t,
  tag: (t) => chalk ? chalk.hex('#94E2D5')(t) : t,
  muted: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
  idx: (t) => chalk ? chalk.hex('#F5C2E7')(t) : t,
};

function run(query, opts = {}) {
  const limit = Math.max(1, Math.min(parseInt(opts.limit) || 15, 100));
  const results = search.search(query, limit);
  if (!results.length) {
    if (opts.json) { console.log('[]'); return; }
    console.log(c.muted('No results'));
    return;
  }
  if (opts.json) {
    const out = results.map(r => {
      const snip = storage.getSnippetByIdOrName(r.id);
      return { id: snip.id, name: snip.name, language: snip.language, tags: snip.tags || [] };
    });
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  results.forEach((r, i) => {
    const snip = storage.getSnippetByIdOrName(r.id);
    const idx = c.idx(`${String(i + 1).padStart(2)}.`);
    const name = c.name(snip.name);
    const tags = (snip.tags || []).length ? c.tag(`[${snip.tags.join(', ')}]`) : '';
    const lang = snip.language ? c.muted(`(${snip.language})`) : '';
    console.log(`  ${idx} ${name} ${lang} ${tags}`);
  });
}

module.exports = run;
