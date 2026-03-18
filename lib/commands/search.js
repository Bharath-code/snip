const search = require('../search');
const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { truncate, actionHint } = require('../format');

function run(query, opts = {}) {
  const limit = Math.max(1, Math.min(parseInt(opts.limit) || 15, 100));
  const results = search.search(query, limit);
  
  if (!results.length) {
    if (opts.json) { 
      console.log('[]'); 
      return; 
    }
    
    console.log('');
    console.log(c.muted('  No results found for: ') + c.brand('"' + query + '"'));
    console.log('');
    console.log(actionHint([
      'snip list:See all',
      'snip search:Browse',
      'snip ui:Interactive',
    ]));
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
  
  // Header
  console.log('');
  console.log(c.dim('  🔍 Searching ') + c.brand('"' + query + '"') + c.dim('... found ' + results.length + ' result' + (results.length === 1 ? '' : 's')));
  console.log('');
  
  // Results with enhanced styling
  results.forEach((r, i) => {
    const snip = storage.getSnippetByIdOrName(r.id);
    const idx = c.dim(String(i + 1).padStart(2) + '.');
    const langIcon = icons.getLangIcon(snip.language);
    const tags = (snip.tags || []).length 
      ? c.tag(icons.tag + ' ' + snip.tags.join(', '))
      : '';
    const name = c.brand(snip.name);
    const lang = snip.language ? c.code(langIcon + ' ' + snip.language) : '';
    const usage = snip.usageCount ? c.dim('[' + snip.usageCount + ']') : '';
    const cmd = c.dim('snip ' + snip.name);
    
    // First row - name, lang, tags
    console.log(`  ${idx} ${name}  ${lang}  ${tags} ${usage}`);
    
    // Second row - preview
    const content = storage.readSnippetContent(snip);
    const preview = truncate(content, 60);
    console.log(c.dim('     └ ') + c.muted(preview));
    console.log('');
  });
  
  // Action hints
  console.log(actionHint([
    'Enter:View',
    'r:Run',
    'c:Copy',
    'e:Edit',
  ]));
}

module.exports = run;
