#!/usr/bin/env node
const { program } = require('commander');
const pkg = require('../package.json');
const config = require('./config');
const addCmd = require('./commands/add');
const listCmd = require('./commands/list');
const searchCmd = require('./commands/search');
const showCmd = require('./commands/show');
const runCmd = require('./commands/run');
const cfgCmd = require('./commands/config');
const updateCmd = require('./commands/update');
const { c } = require('./colors');

const LANG_SHORTCUTS = {
  'js': 'javascript',
  'ts': 'typescript', 'tsx': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash', 'zsh': 'bash', 'fish': 'bash',
  'go': 'go', 'rs': 'rust', 'java': 'java',
  'c': 'c', 'cpp': 'c++',
  'php': 'php', 'pl': 'perl',
};

function parseNameWithLang(name) {
  const match = name.match(/^([^:]+):(\w+)$/);
  if (match) {
    const [, cleanName, langShortcut] = match;
    const lang = LANG_SHORTCUTS[langShortcut] || langShortcut;
    return { name: cleanName, lang };
  }
  return { name, lang: null };
}

program.name('snip').version(pkg.version).description(pkg.description)
  .enablePositionalOptions()
  .option('--no-color', 'Disable colored output')
  .exitOverride();

function showGroupedHelp() {
  console.log('');
  console.log(c.accent('┌─────────────────────────────────────────────────────────────┐'));
  console.log(c.accent('│') + '  SNIPPETS                                            ' + c.accent('│'));
  console.log(c.accent('│') + '    add <name>     Create new snippet                  ' + c.accent('│'));
  console.log(c.accent('│') + '    list           List all snippets                  ' + c.accent('│'));
  console.log(c.accent('│') + '    show <name>    View snippet content               ' + c.accent('│'));
  console.log(c.accent('│') + '    cat <name>     Print raw content (pipe-friendly)   ' + c.accent('│'));
  console.log(c.accent('│') + '    edit <name>    Edit in $EDITOR                    ' + c.accent('│'));
  console.log(c.accent('│') + '    rm <name>      Delete snippet                     ' + c.accent('│'));
  console.log(c.accent('│') + '    cp/mv          Copy or rename                     ' + c.accent('│'));
  console.log(c.accent('├─────────────────────────────────────────────────────────────┤'));
  console.log(c.accent('│') + '  SEARCH                                              ' + c.accent('│'));
  console.log(c.accent('│') + '    search <q>    Fuzzy search by name/tags          ' + c.accent('│'));
  console.log(c.accent('│') + '    recent         Recently used snippets             ' + c.accent('│'));
  console.log(c.accent('│') + '    fzf            Fzf-powered interactive search    ' + c.accent('│'));
  console.log(c.accent('├─────────────────────────────────────────────────────────────┤'));
  console.log(c.accent('│') + '  EXECUTE                                             ' + c.accent('│'));
  console.log(c.accent('│') + '    run <name>     Preview then run (with confirm)   ' + c.accent('│'));
  console.log(c.accent('│') + '    exec <name>   Run immediately (no confirm)       ' + c.accent('│'));
  console.log(c.accent('│') + '    pipe <name>   Run with stdin → template → stdout ' + c.accent('│'));
  console.log(c.accent('│') + '    last           Re-run last snippet               ' + c.accent('│'));
  console.log(c.accent('├─────────────────────────────────────────────────────────────┤'));
  console.log(c.accent('│') + '  SETTINGS                                            ' + c.accent('│'));
  console.log(c.accent('│') + '    config         Get/set config                     ' + c.accent('│'));
  console.log(c.accent('│') + '    init           Guided first-time setup            ' + c.accent('│'));
  console.log(c.accent('│') + '    doctor         Health check                        ' + c.accent('│'));
  console.log(c.accent('│') + '    ui             Interactive TUI browser            ' + c.accent('│'));
  console.log(c.accent('└─────────────────────────────────────────────────────────────┘'));
  console.log('');
  console.log(c.dim('  Quick shortcuts:'));
  console.log(c.dim('    snip add:js myscript    → Add JS snippet'));
  console.log(c.dim('    snip add:py myfunc      → Add Python snippet'));
  console.log(c.dim('    snip add:sh mycmd       → Add shell snippet'));
  console.log('');
  console.log(c.dim('  Examples:'));
  console.log(c.dim('    echo "ls -la" | snip add:sh lla          # Pipe content'));
  console.log(c.dim('    snip search docker --limit 5             # Find snippets'));
  console.log(c.dim('    snip list --tag deploy --sort recent    # Filter & sort'));
  console.log('');
}

program.command('help').action(showGroupedHelp);

// UX: Set NO_COLOR env before commands run so chalk auto-detects it
program.hook('preAction', () => {
  if (program.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
});



program
  .command('add <name>')
  .description('Add a new snippet (supports shortcuts: add:js, add:py, add:sh)')
  .option('--lang <lang>', 'Language (sh, bash, python, js, ts, etc.)')
  .option('--tags <tags>', 'Comma-separated tags')
  .action((name, opts) => {
    const { name: parsedName, lang: parsedLang } = parseNameWithLang(name);
    const finalLang = parsedLang || opts.lang;
    addCmd(parsedName, { ...opts, lang: finalLang });
  });

program
  .command('list')
  .description('List snippets')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--lang <lang>', 'Filter by language')
  .option('--sort <sort>', 'Sort by: name | usage | recent', 'name')
  .option('--limit <n>', 'Max items to show')
  .option('--json', 'Output as JSON')
  .action((opts) => listCmd(opts));

program
  .command('search <query>')
  .description('Fuzzy search by name and tags')
  .option('--limit <n>', 'Max results (default: 15)')
  .option('--json', 'Output as JSON')
  .action((q, opts) => searchCmd(q, opts));

program
  .command('show <idOrName>')
  .description('Show snippet content (use --raw to pipe)')
  .option('--edit', 'Open in editor')
  .option('--json', 'Output as JSON')
  .option('--raw', 'Print raw content (no header, for piping)')
  .action((idOrName, opts) => showCmd(idOrName, opts));

program
  .command('run <idOrName>')
  .description('Run a snippet with preview and confirm (use exec for no prompt)')
  .option('--dry-run', 'Print but do not execute')
  .option('--confirm', 'Skip confirmation prompt (danger check still runs)')
  .action((idOrName, opts) => runCmd(idOrName, opts));

program
  .command('config <action> [key] [value]')
  .description('Get or set config values')
  .action((action, key, value) => cfgCmd(action, key, value));

// additional commands
const editCmd = require('./commands/edit');
const rmCmd = require('./commands/rm');
const exportCmd = require('./commands/export');
const importCmd = require('./commands/import');
const syncCmd = require('./commands/sync');

program
  .command('edit <idOrName>')
  .description('Edit snippet in editor')
  .action((idOrName) => editCmd(idOrName));

program
  .command('rm <idOrName>')
  .alias('delete')
  .description('Remove a snippet (shows preview, prompts for confirmation)')
  .option('-f, --force', 'Skip confirmation')
  .action((idOrName, opts) => rmCmd(idOrName, opts));

program
  .command('update <idOrName>')
  .description('Update snippet metadata (tags, language)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--lang <lang>', 'Language')
  .action((idOrName, opts) => updateCmd(idOrName, opts));

program
  .command('export [path]')
  .description('Export snippets to file (JSON)')
  .action((path) => exportCmd(path));

program
  .command('import <file>')
  .description('Import snippets from file')
  .action((file) => importCmd(file));

program
  .command('sync <action> [id]')
  .description('Sync snippets with GitHub Gists: push|pull')
  .action((action, id) => syncCmd(action, id));

const uiCmd = require('./commands/ui');
program
  .command('ui')
  .description('Interactive TUI: j/k + Ctrl+d/u navigation, Enter show, c copy, r run, t tag filter, / search')
  .action(() => uiCmd());

const execCmd2 = require('./commands/exec');
program
  .command('exec <idOrName>')
  .description('Run snippet immediately without preview (run = preview+confirm, exec = run now)')
  .option('--dry-run', 'Print but do not execute')
  .option('--force', 'Skip dangerous-command warning')
  .action((idOrName, opts) => execCmd2(idOrName, opts));

const aliasCmd = require('./commands/alias');
const pipeCmd = require('./commands/pipe');

program
  .command('pipe <idOrName>')
  .description('Run snippet in pipeline mode (stdin→template→stdout)')
  .option('--json', 'Parse stdin as JSON template values')
  .option('--dry-run', 'Print resolved content without executing')
  .action((idOrName, opts) => pipeCmd(idOrName, opts));

program
  .command('alias [shell]')
  .description('Generate shell aliases for all snippets (eval "$(snip alias)")')
  .action((shell) => aliasCmd(shell));

const doctorCmd = require('./commands/doctor');
program
  .command('doctor')
  .description('Health check — verify storage, editor, fzf, gist sync')
  .action(() => doctorCmd());

const initCmd = require('./commands/init');
program
  .command('init')
  .description('Guided setup: editor, widget, example snippets, optional TUI')
  .action(() => initCmd());

const fzfCmd = require('./commands/fzf');
program
  .command('fzf')
  .description('Search snippets with fzf (requires fzf installed)')
  .action(() => fzfCmd());

program
  .command('completion [shell]')
  .description('Output shell completion script (bash, zsh, fish)')
  .action((shell) => {
    const path = require('path');
    const fs = require('fs');
    const s = (shell || process.env.SHELL || '').toLowerCase();
    let file;
    if (s.includes('fish')) {
      file = path.join(__dirname, '..', 'completions', 'snip.fish');
    } else {
      file = path.join(__dirname, '..', 'completions', 'snip.bash');
    }
    try {
      process.stdout.write(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error('Completion file not found:', file);
    }
  });

const seedCmd = require('../scripts/seed-examples.js');
program
  .command('seed')
  .description('Clear all snippet data (JSON + SQLite) and add 10 example snippets')
  .action(() => seedCmd.main());

const widgetCmd = require('./commands/widget');
program
  .command('widget [shell]')
  .description('Output shell widget function (Ctrl+G hotkey) for zsh, bash, or fish')
  .action((shell) => widgetCmd(shell));

const grabCmd = require('./commands/grab');
program
  .command('grab <url>')
  .description('Import a snippet from a URL or github:user/repo/path')
  .option('--name <name>', 'Snippet name (auto-derived from URL if omitted)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--lang <lang>', 'Language (auto-detected if omitted)')
  .action((url, opts) => grabCmd(url, opts));

const statsCmd = require('./commands/stats');
program
  .command('stats')
  .description('Show snippet library statistics')
  .option('--json', 'Output as JSON')
  .option('--streak', 'Show days-in-a-row usage streak')
  .action((opts) => statsCmd(opts));

const lastCmd = require('./commands/last');
program
  .command('last')
  .description('Re-run the last executed snippet')
  .action(() => lastCmd());

const importHistoryCmd = require('./commands/import-history');
program
  .command('import-history')
  .description('Suggest commands from shell history run 3+ times')
  .option('--last <n>', 'Analyze last N history lines', '500')
  .option('--min-count <n>', 'Minimum run count to suggest', '3')
  .option('--json', 'Output as JSON')
  .action((opts) => importHistoryCmd(opts));

program
  .command('cp <source> <dest>')
  .description('Duplicate a snippet')
  .action((source, dest) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(source);
    if (!s) { console.error(`Snippet not found: "${source}"`); process.exitCode = 1; return; }
    const content = storage.readSnippetContent(s);
    const newSnippet = storage.addSnippet({ name: dest, content, language: s.language, tags: s.tags || [] });
    console.log(`Copied "${s.name}" → "${newSnippet.name}"`);
  });

program
  .command('mv <source> <newName>')
  .description('Rename a snippet')
  .action((source, newName) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(source);
    if (!s) { console.error(`Snippet not found: "${source}"`); process.exitCode = 1; return; }
    storage.updateSnippetMeta(s.id, { name: newName });
    console.log(`Renamed "${s.name}" → "${newName}"`);
  });

program
  .command('cat <idOrName>')
  .description('Print raw snippet content to stdout (for piping)')
  .action((idOrName) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(idOrName);
    if (!s) { console.error('Snippet not found'); process.exitCode = 1; return; }
    process.stdout.write(storage.readSnippetContent(s) || '');
  });

program
  .command('recent [count]')
  .description('Show recently used snippets')
  .action((count) => {
    const storage = require('./storage');
    const n = Math.min(parseInt(count) || 5, 20);
    const all = storage.listSnippets();
    const sorted = all
      .filter(s => s.lastUsedAt || s.updatedAt)
      .sort((a, b) => {
        const aTs = Date.parse(a.lastUsedAt || a.updatedAt || 0) || 0;
        const bTs = Date.parse(b.lastUsedAt || b.updatedAt || 0) || 0;
        return bTs - aTs;
      })
      .slice(0, n);
    if (!sorted.length) { console.log('No recent snippets.'); return; }
    sorted.forEach((s, i) => {
      const ago = s.lastUsedAt || s.updatedAt || '';
      console.log(`${i + 1}. ${s.name} [${s.language || ''}] ${ago}`);
    });
  });

const fs = require('fs');
const cfg = config.loadConfig();

// First-run onboarding: when no commands provided and DB missing
if (process.argv.length <= 2) {
  try {
    if (!fs.existsSync(cfg.dbPath)) {
      console.log('\nWelcome to snip — your terminal snippet manager!');
      console.log('\nQuick start:\n  1) Set your editor: snip config set editor "code --wait"\n  2) Add a snippet: echo "echo \'hello\'" | snip add hello --lang sh --tags demo\n  3) List snippets: snip list\n  4) Search and run: snip search hello && snip run hello --dry-run');
      console.log('\nTip: install locally with `npm link` to use the `snip` command.\n');
    }
  } catch (_e) { }
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showGroupedHelp();
  process.exit(0);
}

try {
  program.parse(process.argv);
} catch (err) {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    process.exit(0);
  }
  throw err;
}
