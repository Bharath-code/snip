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
  .exitOverride()
  .configureOutput({
    writeErr: (str) => {
      // Suppress Commander's default error output - we'll handle errors ourselves
      if (str.includes('unknown command') || str.includes('missing required argument')) {
        return; // Suppress these
      }
      process.stderr.write(str);
    }
  });

function showGroupedHelp() {
  const I = {
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
  };
  
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

program.command('help').action(showGroupedHelp);

// UX: Set NO_COLOR env before commands run so chalk auto-detects it
program.hook('preAction', () => {
  if (program.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
});



// Custom parser to handle "add:lang name" syntax
function parseAddCommand(args) {
  if (args.length === 0) return null;
  
  const firstArg = args[0];
  const match = firstArg.match(/^add:(\w+)$/);
  
  if (match) {
    const lang = LANG_SHORTCUTS[match[1]] || match[1];
    const remainingArgs = args.slice(1);
    return { lang, remainingArgs };
  }
  
  return null;
}

// Override Commander's error handling for missing arguments
program.on('command:missing', (data) => {
  const cmdName = data[0];
  const parsed = parseAddCommand([cmdName]);
  
  if (parsed) {
    // Handle add:lang with missing name
    console.error(c.err('  Error: Please provide a snippet name'));
    console.log(c.dim('  Usage: snip add:js <name>'));
    console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
  } else {
    console.error(c.err('  Missing required argument'));
    console.log(c.dim('  Run snip --help for usage'));
  }
  process.exit(1);
});

// Handle unknown commands like "add:js"
program.on('command:unknown', (data) => {
  const cmdName = data[0];
  const args = data[1] || [];
  const parsed = parseAddCommand([cmdName, ...args]);
  
  if (parsed) {
    // Handle add:lang syntax - call add command with parsed language
    const name = parsed.remainingArgs[0] || '';
    if (!name) {
      console.error(c.err('  Error: Please provide a snippet name'));
      console.log(c.dim('  Usage: snip add:js <name>'));
      console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
      process.exit(1);
      return;
    }
    addCmd(name, { lang: parsed.lang, tags: '' });
  } else {
    console.error(c.err('  Unknown command: ') + c.brand(cmdName));
    console.log(c.dim('\n  Did you mean?'));
    console.log(c.dim('    snip add <name>    - Create a snippet'));
    console.log(c.dim('    snip list          - List snippets'));
    console.log(c.dim('    snip search <query> - Search'));
    console.log(c.dim('\n  Run snip --help for all commands'));
    process.exit(1);
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
  .command('ai generate <prompt>')
  .description('Generate a snippet using AI')
  .option('--lang <lang>', 'Target language (auto-detect if not specified)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--name <name>', 'Snippet name (auto-generated if not specified)')
  .option('--model <model>', 'AI model to use (default: gpt-3.5-turbo)')
  .action((prompt, opts) => require('./commands/ai').generate(prompt, opts));

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
      console.log('');
      console.log(c.brand('  ╭──────────────────────────────────────────────╮'));
      console.log(c.brand('  │') + c.brand('    Welcome to snip — your terminal memory!   ') + c.brand('│'));
      console.log(c.brand('  ╰──────────────────────────────────────────────╯'));
      console.log('');
      console.log(c.dim('  Quick start:'));
      console.log(c.code('    1. snip config set editor "code --wait"'));
      console.log(c.code('    2. echo "echo hello" | snip add hello --lang sh'));
      console.log(c.code('    3. snip list'));
      console.log(c.code('    4. snip search hello && snip run hello'));
      console.log('');
      console.log(c.muted('  Tip: Run ') + c.brand('snip init') + c.muted(' for guided setup'));
      console.log('');
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
  
  // Handle unknown commands like "add:js", "add:py"
  if (err.code === 'commander.unknownCommand') {
    const unknownCmd = process.argv[2] || '';
    const parsed = parseAddCommand([unknownCmd, ...process.argv.slice(3)]);
    
    if (parsed) {
      // Handle add:lang syntax
      const name = parsed.remainingArgs[0] || '';
      if (!name) {
        console.error(c.err('  Error: Please provide a snippet name'));
        console.log(c.dim('  Usage: snip add:js <name>'));
        console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
        process.exit(1);
        return;
      }
      addCmd(name, { lang: parsed.lang, tags: '' });
      return;
    }
    
    // Generic unknown command handling
    console.error(c.err('  Unknown command: ') + c.brand(unknownCmd));
    console.log(c.dim('\n  Did you mean?'));
    console.log(c.dim('    snip add <name>    - Create a snippet'));
    console.log(c.dim('    snip list          - List snippets'));
    console.log(c.dim('    snip search <query> - Search'));
    console.log(c.dim('\n  Run snip --help for all commands'));
    process.exit(1);
  }
  
  // Handle missing argument errors with nice messaging
  if (err.code === 'commander.missingArgument') {
    console.error(c.err('  ✗ Missing required argument'));
    // Try to provide context based on the command
    const cmd = process.argv[2] || '';
    if (cmd === 'show' || cmd === 'exec' || cmd === 'run' || cmd === 'edit' || cmd === 'rm') {
      console.log(c.dim('  Usage: snip ' + cmd + ' <snippet-name>'));
      console.log(c.dim('  Run: snip list to see available snippets'));
    } else if (cmd === 'add') {
      console.log(c.dim('  Usage: snip add <name>'));
      console.log(c.dim('       snip add:js <name>'));
    } else if (cmd === 'search') {
      console.log(c.dim('  Usage: snip search <query>'));
    } else if (cmd === 'cp' || cmd === 'mv') {
      console.log(c.dim('  Usage: snip ' + cmd + ' <source> <dest>'));
    } else {
      console.log(c.dim('  Run snip --help for usage'));
    }
    process.exit(1);
  }
  
  throw err;
}
