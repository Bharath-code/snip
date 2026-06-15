/**
 * Grouped help display — box-drawn help output for the snip CLI.
 * Extracted from cli.js for maintainability.
 */

const { c } = require('./colors');

const CATEGORY_ICONS = {
  add: '✦',
  list: '☰',
  show: '◉',
  cat: '▸',
  edit: '✎',
  rm: '✕',
  cp: '⧉',
  search: '⌘',
  recent: '↺',
  fzf: '⚡',
  run: '▶',
  exec: '⏯',
  pipe: '⟹',
  last: '↩',
  config: '⚙',
  init: '✳',
  doctor: '✚',
  ui: '⊞',
  'ai generate': '🤖',
  share: '📤',
  discover: '🌐',
  sync: '↻',
};

function showGroupedHelp() {
  const I = CATEGORY_ICONS;

  console.log('');
  console.log(c.brand('  ╭─────────────────────────────────────────────────────╮'));
  console.log(c.brand('  │') + c.brand('  SNIPPETS') + c.muted('                                    │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I.add + ' add <name>     Create new snippet             ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.list + ' list           List all snippets               ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.show + ' show <name>    View snippet content            ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.cat + ' cat <name>     Print raw (pipe-friendly)        ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.edit + ' edit <name>    Edit in $EDITOR                 ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.rm + ' rm <name>      Delete snippet                    ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.cp + ' cp/mv          Copy or rename                    ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  SEARCH') + c.muted('                                        │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I.search + ' search <q>    Fuzzy search by name/tags        ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.recent + ' recent         Recently used snippets           ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.fzf + ' fzf            Fzf-powered interactive search   ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  EXECUTE') + c.muted('                                       │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I.run + ' run <name>     Preview then run (with confirm)  ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.exec + ' exec <name>   Run immediately (no confirm)      ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.pipe + ' pipe <name>   Run with stdin → template → stdout' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.last + ' last           Re-run last snippet               ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  SETTINGS') + c.muted('                                      │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I.config + ' config         Get/set config                    ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.init + ' init           Guided first-time setup           ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.doctor + ' doctor         Health check                       ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.ui + ' ui             Interactive TUI browser            ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  AI') + c.muted('                                              │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I['ai generate'] + ' ai generate    Generate snippets with AI      ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  SHARING') + c.muted('                                      │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '    ' + I.share + ' share <name>  Publish snippet(s) as public Gist ' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.discover + ' discover      Search community-shared public gists' + c.brand('│'));
  console.log(c.brand('  │') + '    ' + I.sync + ' sync push/pull GitHub Gist sync                ' + c.brand('│'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + c.brand('  CONTEXT') + c.muted('                                      │'));
  console.log(c.brand('  ├─────────────────────────────────────────────────────┤'));
  console.log(c.brand('  │') + '           suggest       Context-aware suggestions        ' + c.brand('│'));
  console.log(c.brand('  ╰─────────────────────────────────────────────────────╯'));
  console.log('');
  console.log(c.dim('  Quick shortcuts:'));
  console.log(c.dim('    ') + c.brand('snip add:js myscript   → Add JS snippet'));
  console.log(c.dim('    ') + c.brand('snip add:py myfunc     → Add Python snippet'));
  console.log(c.dim('    ') + c.brand('snip add:sh mycmd      → Add shell snippet'));
  console.log('');
  console.log(c.dim('  Examples:'));
  console.log(c.dim('    ') + c.code('echo "ls -la" | snip add:sh lla') + c.muted('  # Pipe content'));
  console.log(c.dim('    ') + c.code('snip search docker --limit 5') + c.muted('            # Find snippets'));
  console.log(c.dim('    ') + c.code('snip list --tag deploy --sort recent') + c.muted(' # Filter & sort'));
  console.log('');
}

module.exports = { showGroupedHelp, CATEGORY_ICONS };
