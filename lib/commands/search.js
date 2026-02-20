const search = require('../search');
const storage = require('../storage');

function run(query, opts = {}) {
  const results = search.search(query, 15);
  if (!results.length) {
    if (opts.json) { console.log('[]'); return; }
    return console.log('No results');
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
    console.log(`${i + 1}. ${snip.name} (${snip.id}) [${(snip.tags || []).join(', ')}]`);
  });
}

module.exports = run;
