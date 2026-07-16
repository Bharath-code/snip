#!/usr/bin/env node
const { program } = require('commander');
const pkg = require('../package.json');
const config = require('./config');
const { c } = require('./colors');
const { log, isQuiet } = require('./quiet');
const { showGroupedHelp } = require('./help');
const { parseNameWithLang, parseAddCommand, setExitCode, exitProcess } = require('./cli-utils');

// ── Command handlers ──
const addCmd = require('./commands/add');
const listCmd = require('./commands/list');
const searchCmd = require('./commands/search');
const showCmd = require('./commands/show');
const runCmd = require('./commands/run');
const cfgCmd = require('./commands/config');
const updateCmd = require('./commands/update');
const editCmd = require('./commands/edit');
const rmCmd = require('./commands/rm');
const exportCmd = require('./commands/export');
const importCmd = require('./commands/import');
const syncCmd = require('./commands/sync');
const teamCmd = require('./commands/team');
// ui pulls blessed + cli-highlight (~200ms) — lazy-load at action time
const uiCmd = (...a) => require('./commands/ui')(...a);
const execCmd2 = require('./commands/exec');
const aliasCmd = require('./commands/alias');
const pipeCmd = require('./commands/pipe');
const doctorCmd = require('./commands/doctor');
const initCmd = require('./commands/init');
const fzfCmd = require('./commands/fzf');
const widgetCmd = require('./commands/widget');
const grabCmd = require('./commands/grab');
const statsCmd = require('./commands/stats');
const lastCmd = require('./commands/last');
const suggestCmd = require('./commands/suggest');
const importHistoryCmd = require('./commands/import-history');
const historyCmd = require('./commands/history');
const diffCmd = require('./commands/diff');
const undoCmd = require('./commands/undo');
const { shareCmd, unshareCmd } = require('./commands/share');
const discoverCmd = require('./commands/discover');
const watchCmd = require('./commands/watch');
const installCmd = require('./commands/install');
const packsCmd = require('./commands/packs');
const watchHistoryCmd = require('./commands/watch-history');
const dashboardCmd = require('./commands/dashboard');

// ── Program Setup ──

program.name('snip').version(pkg.version).description(pkg.description)
  .enablePositionalOptions()
  .option('--no-color', 'Disable colored output')
  .option('-q, --quiet', 'Suppress non-essential output (for scripting/CI)')
  .exitOverride()
  .configureOutput({
    writeErr: (str) => {
      // Suppress Commander's default error output - we'll handle errors ourselves
      if (str.includes('unknown command') || str.includes('missing required argument')) return;
      process.stderr.write(str);
    }
  });

program.hook('preAction', () => {
  if (program.opts().color === false) process.env.NO_COLOR = '1';
  if (program.opts().quiet) process.env.SNIP_QUIET = '1';
});

// ── Error Handlers ──

program.on('command:missing', (data) => {
  const cmdName = data[0];
  const parsed = parseAddCommand([cmdName]);
  if (parsed) {
    console.error(c.err('  Error: Please provide a snippet name'));
    console.log(c.dim('  Usage: snip add:js <name>'));
    console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
  } else {
    console.error(c.err('  Missing required argument'));
    console.log(c.dim('  Run snip --help for usage'));
  }    exitProcess(2); // misuse: missing required argument
});

program.on('command:unknown', (data) => {
  const cmdName = data[0];
  const args = data[1] || [];
  const parsed = parseAddCommand([cmdName, ...args]);
  if (parsed) {
    const name = parsed.remainingArgs[0] || '';      if (!name) {
        console.error(c.err('  Error: Please provide a snippet name'));
        console.log(c.dim('  Usage: snip add:js <name>'));
        console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
        exitProcess(2);
      }
      addCmd(name, { lang: parsed.lang, tags: '' });
    } else {
    console.error(c.err('  Unknown command: ') + c.brand(cmdName));
    console.log(c.dim('\n  Did you mean?'));
    console.log(c.dim('    snip add <name>    - Create a snippet'));
    console.log(c.dim('    snip list          - List snippets'));
    console.log(c.dim('    snip search <query> - Search'));
    console.log(c.dim('\n  Run snip --help for all commands'));
    exitProcess(2); // misuse: unknown command
  }
});

// ── Command Registrations ──

program.command('help').action(showGroupedHelp);

program
  .command('add <name>')
  .description('Add a new snippet (supports shortcuts: add:js, add:py, add:sh)')
  .option('--lang <lang>', 'Language (sh, bash, python, js, ts, etc.)')
  .option('--tags <tags>', 'Comma-separated tags')
  .action((name, opts) => {
    const { name: parsedName, lang: parsedLang } = parseNameWithLang(name);
    addCmd(parsedName, { ...opts, lang: parsedLang || opts.lang });
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
  .option('--rev <version>', 'Show a specific version (number or "latest")')
  .action((idOrName, opts) => showCmd(idOrName, opts));

program
  .command('run <idOrName>')
  .description('Run a snippet with preview and confirm (use exec for no prompt)')
  .option('--dry-run', 'Print but do not execute')
  .option('--confirm', 'Skip confirmation prompt (danger check still runs)')
  .action((idOrName, opts) => runCmd(idOrName, opts));

program
  .command('approve [id]')
  .description('List or confirm pending agent executions gated by .snip/policy.json')
  .option('--reject', 'Discard the pending execution instead of running it')
  .action((id, opts) => require('./commands/approve')(id, opts));

program
  .command('exec <idOrName>')
  .description('Run snippet immediately without preview (run = preview+confirm, exec = run now)')
  .option('--dry-run', 'Print but do not execute')
  .option('--force', 'Skip dangerous-command warning')
  .action((idOrName, opts) => execCmd2(idOrName, opts));

program
  .command('config <action> [key] [value]')
  .description('Get, set, or list config values (actions: get, set, list)')
  .action((action, key, value) => cfgCmd(action, key, value));

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
  .command('pipe <idOrName>')
  .description('Run snippet in pipeline mode (stdin→template→stdout)')
  .option('--json', 'Parse stdin as JSON template values')
  .option('--dry-run', 'Print resolved content without executing')
  .action((idOrName, opts) => pipeCmd(idOrName, opts));

program
  .command('cp <source> <dest>')
  .description('Duplicate a snippet')
  .action((source, dest) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(source);
    if (!s) { console.error(`Snippet not found: "${source}"`); setExitCode(1); return; }
    const content = storage.readSnippetContent(s);
    const newSnippet = storage.addSnippet({ name: dest, content, language: s.language, tags: s.tags || [] });
    log(`Copied "${s.name}" → "${newSnippet.name}"`);
  });

program
  .command('mv <source> <newName>')
  .description('Rename a snippet')
  .action((source, newName) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(source);
    if (!s) { console.error(`Snippet not found: "${source}"`); setExitCode(1); return; }
    storage.updateSnippetMeta(s.id, { name: newName });
    log(`Renamed "${s.name}" → "${newName}"`);
  });

program
  .command('cat <idOrName>')
  .description('Print raw snippet content to stdout (for piping)')
  .action((idOrName) => {
    const storage = require('./storage');
    const s = storage.getSnippetByIdOrName(idOrName);
    if (!s) { console.error('Snippet not found'); setExitCode(1); return; }
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
    if (!sorted.length) { log('No recent snippets.'); return; }
    sorted.forEach((s, i) => {
      const ago = s.lastUsedAt || s.updatedAt || '';
      console.log(`${i + 1}. ${s.name} [${s.language || ''}] ${ago}`);
    });
  });

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

program
  .command('share <names...>')
  .description('Publish snippet(s) as a public Gist (share a single snippet or a pack)')
  .option('--copy', 'Copy the Gist URL to clipboard')
  .option('--json', 'Output as JSON')
  .action((names, opts) => shareCmd(names, opts));

program
  .command('unshare <idOrName>')
  .alias('unpublish')
  .description('Delete a shared Gist (unpublish a previously shared snippet)')
  .option('--json', 'Output as JSON')
  .action((idOrName, opts) => unshareCmd(idOrName, opts));

program
  .command('discover [query]')
  .description('Search public gists shared by the community')
  .option('--lang <lang>', 'Filter by language')
  .option('--limit <n>', 'Max results (default: 15 for search, 30 for --recent)')
  .option('--recent', 'Browse recent public gists instead of searching')
  .option('--snip-only', 'Only show gists with "snip:" description (use with --recent)')
  .option('--json', 'Output as JSON')
  .action((query, opts) => discoverCmd(query, opts));

program
  .command('team <subcmd> [args...]')
  .description('Team workspace: init|add|list|sync|push|status')
  .option('--lang <lang>', 'Language for snip team add')
  .option('--tags <tags>', 'Comma-separated tags for snip team add')
  .option('--json', 'JSON output for snip team status')
  .action((subcmd, args, opts) => teamCmd(subcmd, ...args, opts));

program
  .command('alias [shell]')
  .description('Generate shell aliases for all snippets (eval "$(snip alias)")')
  .action((shell) => aliasCmd(shell));

program
  .command('doctor')
  .description('Health check — verify storage, editor, fzf, gist sync')
  .action(() => doctorCmd());

program
  .command('init')
  .description('Guided setup: editor, widget, example snippets, optional TUI')
  .action(() => initCmd());

program
  .command('fzf')
  .description('Search snippets with fzf (requires fzf installed)')
  .action(() => fzfCmd());

program
  .command('ui')
  .description('Interactive TUI: j/k + Ctrl+d/u navigation, Enter show, c copy, r run, t tag filter, / search')
  .action(() => uiCmd());

program
  .command('dashboard')
  .description('Launch the local Web Dashboard')
  .option('-p, --port <number>', 'Port to run the dashboard server on', 5500)
  .action((opts) => {
    // Parse port as integer if provided
    if (opts.port) opts.port = parseInt(opts.port, 10);
    dashboardCmd(opts);
  });

program
  .command('stats')
  .description('Show snippet library statistics')
  .option('--json', 'Output as JSON')
  .option('--streak', 'Show days-in-a-row usage streak')
  .action((opts) => statsCmd(opts));

program
  .command('last')
  .description('Re-run the last executed snippet')
  .action(() => lastCmd());

program
  .command('grab <url>')
  .description('Import a snippet from a URL or github:user/repo/path')
  .option('--name <name>', 'Snippet name (auto-derived from URL if omitted)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--lang <lang>', 'Language (auto-detected if omitted)')
  .action((url, opts) => grabCmd(url, opts));

program
  .command('install <pack>')
  .description('Install a snippet pack from the community registry (e.g. docker-essentials, git-workflow)')
  .action((pack) => installCmd(pack).catch(e => { console.error(e); process.exitCode = 1; }));

program
  .command('packs')
  .description('List available snippet packs from the community registry')
  .action(() => packsCmd());

program
  .command('widget [shell]')
  .description('Output shell widget function (Ctrl+G hotkey) for zsh, bash, or fish')
  .action((shell) => widgetCmd(shell));

program
  .command('completion [shell]')
  .description('Output shell completion script (bash, zsh, fish)')
  .action((shell) => {
    const path = require('path');
    const fs = require('fs');
    const s = (shell || process.env.SHELL || '').toLowerCase();
    const file = s.includes('fish')
      ? path.join(__dirname, '..', 'completions', 'snip.fish')
      : path.join(__dirname, '..', 'completions', 'snip.bash');
    try {
      process.stdout.write(fs.readFileSync(file, 'utf8'));
    } catch (_e) {
      console.error('Completion file not found:', file);
    }
  });

program
  .command('seed')
  .description('Clear all snippet data (JSON + SQLite) and add 10 example snippets')
  .action(() => require('../scripts/seed-examples.js').main());

const mcpCmd = program
  .command('mcp')
  .description('Start the MCP server (Model Context Protocol) for AI agent integration')
  .action(() => {
    require('./mcp-server').start().catch(err => {
      console.error('MCP server error:', err);
      exitProcess(1);
    });
  });
mcpCmd
  .command('install <client>')
  .description('Configure snip as an MCP server for a client (claude, cursor, goose, continue)')
  .action((client) => require('./commands/mcp-install').mcpInstallCmd(client));

program
  .command('history <idOrName>')
  .description('Show snippet version history')
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Max versions to show')
  .action((idOrName, opts) => historyCmd(idOrName, opts));

program
  .command('diff <idOrName> [versionA] [versionB]')
  .description('Diff two versions of a snippet (use numbers, "prev", or "current")')
  .option('--json', 'Output as JSON')
  .action((idOrName, versionA, versionB, opts) => diffCmd(idOrName, { ...opts, versionA, versionB }));

program
  .command('undo <idOrName>')
  .description('Rollback a snippet to its previous version')
  .option('--rev <n>', 'Rollback to a specific version number')
  .option('--json', 'Output as JSON')
  .action((idOrName, opts) => undoCmd(idOrName, opts));

program
  .command('watch <idOrName>')
  .description('Watch a snippet file for changes and re-run on every save')
  .option('--editor <cmd>', 'Editor to open (e.g. vim, code). If omitted, just shows the file path.')
  .action((idOrName, opts) => watchCmd(idOrName, opts));

program
  .command('suggest')
  .description('Show context-aware snippet suggestions based on current directory')
  .option('--json', 'Output as JSON')
  .option('--all', 'Show all snippets scored (including 0-relevance)')
  .option('--dir <path>', 'Analyze a different directory')
  .option('--limit <n>', 'Max suggestions', '10')
  .action((opts) => suggestCmd(opts));

program
  .command('import-history')
  .description('Suggest & save commands from shell history run 3+ times')
  .option('--last <n>', 'Analyze last N history lines', '500')
  .option('--min-count <n>', 'Minimum run count to suggest', '3')
  .option('--interactive, -i', 'Review each suggestion and choose to save')
  .option('--auto', 'Auto-save all suggestions without prompting')
  .option('--json', 'Output as JSON')
  .action((opts) => importHistoryCmd(opts));

program
  .command('watch-history')
  .description('Watch shell history for repeated commands and offer to save as snippets')
  .option('--interval <n>', 'Poll interval in seconds', '60')
  .option('--last <n>', 'Number of recent history lines to analyze', '100')
  .option('--min-count <n>', 'Minimum run count to suggest', '3')
  .option('--auto', 'Auto-save without prompting')
  .option('--once', 'Run once and exit (non-watching mode)')
  .action((opts) => watchHistoryCmd(opts));

program
  .command('ai generate <prompt>')
  .description('Generate a snippet using AI')
  .option('--lang <lang>', 'Target language (auto-detect if not specified)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--name <name>', 'Snippet name (auto-generated if not specified)')
  .option('--model <model>', 'AI model to use (default: gpt-3.5-turbo)')
  .action((prompt, opts) => require('./commands/ai').generate(prompt, opts));

// ── First-Run Onboarding ──

const fs = require('fs');
const cfg = config.loadConfig();

if (!isQuiet() && process.argv.length <= 2) {
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
  exitProcess(0);
}

// ── Parse & Error Handling ──

try {
  program.parse(process.argv);
} catch (err) {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    exitProcess(0);
  }

  if (err.code === 'commander.unknownCommand') {
    const unknownCmd = process.argv[2] || '';
    const parsed = parseAddCommand([unknownCmd, ...process.argv.slice(3)]);
    if (parsed) {
      const name = parsed.remainingArgs[0] || '';
      if (!name) {
        console.error(c.err('  Error: Please provide a snippet name'));
        console.log(c.dim('  Usage: snip add:js <name>'));
        console.log(c.dim('       snip add <name> --lang ' + parsed.lang));
        exitProcess(2); // misuse: missing snippet name
      }
      addCmd(name, { lang: parsed.lang, tags: '' });
    }
    console.error(c.err('  Unknown command: ') + c.brand(unknownCmd));
    console.log(c.dim('\n  Did you mean?'));
    console.log(c.dim('    snip add <name>    - Create a snippet'));
    console.log(c.dim('    snip list          - List snippets'));
    console.log(c.dim('    snip search <query> - Search'));
    console.log(c.dim('\n  Run snip --help for all commands'));
    exitProcess(2); // misuse: unknown command
  }

  if (err.code === 'commander.missingArgument') {
    console.error(c.err('  ✗ Missing required argument'));
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
    exitProcess(2); // misuse: missing required argument
  }

  throw err;
}
