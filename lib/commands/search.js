const search = require('../search');
const storage = require('../storage');

function run(query) {
  const results = search.search(query, 15);
  if (!results.length) return console.log('No results');
  results.forEach((r, i) => {
    const snip = storage.getSnippetByIdOrName(r.id);
    console.log(`${i+1}. ${snip.name} (${snip.id}) [${(snip.tags||[]).join(', ')}]`);
  });
}

module.exports = run;
