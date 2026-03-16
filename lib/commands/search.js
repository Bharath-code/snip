const search = require('../search');
const storage = require('../storage');

// UX: Colored output (graceful fallback)
let chalk = null;
try {
  const m = require('chalk');
  chalk = (m && m.default) ? m.default : m;
} catch (_) { }
const c = {
  name: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  tag: (t) => chalk ? chalk.hex('#F5A623')(t) : t,
  muted: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
  idx: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
  accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  dim: (t) => chalk ? chalk.dim(t) : t,
};

function run(query, opts = {}) {
  const limit = Math.max(1, Math.min(parseInt(opts.limit) || 15, 100));
  const results = search.search(query, limit);
  if (!results.length) {
    if (opts.json) { console.log('[]'); return; }
    console.log(c.muted('No results found for:') + c.accent(` "${query}"`));
    console.log(c.dim('  Try:'));
    console.log(c.dim('    • snip list              # See all snippets'));
    console.log(c.dim('    • snip search             # Browse without query'));
    console.log(c.dim('    • snip ui                # Interactive TUI'));
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
  // UX: Show result count and tips
  console.log(c.dim(`  Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`));
  console.log('');
  results.forEach((r, i) => {
    const snip = storage.getSnippetByIdOrName(r.id);
    const idx = c.idx(`${String(i + 1).padStart(2)}.`);
    const name = c.name(snip.name);
    const tags = (snip.tags || []).length ? c.tag(`[${snip.tags.join(', ')}]`) : '';
    const lang = snip.language ? c.muted(`(${snip.language})`) : '';
    const cmd = c.dim(`snip ${snip.name}`);
    console.log(`  ${idx} ${name} ${lang} ${tags}`);
    console.log(c.dim(`     └ ${cmd}`));
  });
  console.log('');
  console.log(c.dim('  Tip:') + c.dim(` snip show <name>    # View content`));
  console.log(c.dim('       snip exec <name>   # Run immediately'));
}

module.exports = run;
