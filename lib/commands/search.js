const search = require('../search');
const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { truncate, actionHint, stripAnsi, box } = require('../format');
const { log } = require('../quiet');

function run(query, opts = {}) {
  const limit = Math.max(1, Math.min(parseInt(opts.limit) || 15, 100));
  const results = search.search(query, limit);
  
  if (!results.length) {
    if (opts.json) { 
      console.log('[]'); 
      return; 
    }
    
    log('');
    log(c.dim('  ' + icons.search + ' Searching ') + c.brand('"' + query + '"') + c.dim('... no results'));
    log('');
    log(box(
      '  No snippets match your query.\n\n  Try different keywords or browse all snippets.',
      { title: 'No results', borderColor: c.muted, titleColor: c.muted }
    ));
    log('');
    log(actionHint([
      'snip list:See all',
      'snip search <query>:Try again',
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
  
  // Header with box drawing
  log('');
  log(c.dim('  ' + icons.search + ' Searching ') + c.brand('"' + query + '"') + c.dim('... found ' + results.length + ' result' + (results.length === 1 ? '' : 's')));
  log('');
  
  const cols = Math.min(process.stdout.columns || 80, 72);
  
  // Results with card-style display
  results.forEach((r, i) => {
    const snip = storage.getSnippetByIdOrName(r.id);
    const content = storage.readSnippetContent(snip);
    const preview = truncate(content || '', 80);
    
    const idx = c.dim(String(i + 1).padStart(2));
    const langIcon = icons.getLangIcon(snip.language);
    const name = c.brand(snip.name);
    const lang = snip.language ? c.code(langIcon + ' ' + snip.language) : '';
    const tags = (snip.tags || []).length 
      ? c.tag(icons.tag + ' ' + snip.tags.join(', '))
      : '';
    const usage = snip.usageCount ? c.dim('[' + snip.usageCount + ']') : '';
    
    // Card top border
    log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));
    
    // Row 1: number, name, lang, tags, usage — data output, always show
    const row1 = `${idx}  ${name}`;
    const meta = [lang, tags, usage].filter(Boolean).join('  ');
    const row1Full = row1 + (meta ? c.muted('  ·  ') + meta : '');
    const row1Padding = Math.max(0, cols - 2 - stripAnsi(row1Full).length - 1);
    console.log(c.border('  │') + ' ' + row1Full + ' '.repeat(row1Padding) + c.border('│'));
    
    // Row 2: preview line
    if (preview) {
      const previewStr = c.muted('    ' + preview);
      const previewLen = stripAnsi(previewStr).length;
      const previewPadding = Math.max(0, cols - 2 - previewLen - 1);
      console.log(c.border('  │') + previewStr + ' '.repeat(previewPadding) + c.border('│'));
    }
    
    // Card bottom border
    log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));
    log('');
  });
  
  // Action hints
  log(actionHint([
    'snip show <name>:View',
    'snip run <name>:Run',
    'snip exec <name>:Execute',
  ]));
}

module.exports = run;
