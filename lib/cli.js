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

program.name('snip').version(pkg.version).description(pkg.description)
  .enablePositionalOptions()
  .option('--no-color', 'Disable colored output');

// UX: Set NO_COLOR env before commands run so chalk auto-detects it
program.hook('preAction', () => {
  if (program.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
});

program
  .command('add <name>')
  .description('Add a new snippet')
  .option('--lang <lang>')
  .option('--tags <tags>')
  .action((name, opts) => addCmd(name, opts));

program
  .command('list')
  .description('List snippets')
  .option('-t, --tag <tag>')
  .option('--lang <lang>')
  .option('--sort <sort>', 'Sort by: name | usage | recent', 'name')
  .option('--limit <n>', 'Max items to show')
  .option('--json', 'Output as JSON')
  .action((opts) => listCmd(opts));

program
  .command('search <query>')
  .description('Fuzzy search snippets')
  .option('--limit <n>', 'Max results (default: 15)')
  .option('--json', 'Output as JSON')
  .action((q, opts) => searchCmd(q, opts));

program
  .command('show <idOrName>')
  .description('Show snippet content')
  .option('--edit', 'Open in editor')
  .option('--json', 'Output as JSON')
  .option('--raw', 'Print raw content (no header, for piping)')
  .action((idOrName, opts) => showCmd(idOrName, opts));

program
  .command('run <idOrName>')
  .description('Run a snippet (preview + confirm)')
  .option('--dry-run', 'Print but do not execute')
  .option('--confirm', 'Skip confirmation prompt; allow running dangerous snippets (use with care)')
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
  .description('Remove a snippet')
  .action((idOrName) => rmCmd(idOrName));

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
  .description('Run a snippet immediately (no preview modal)')
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
  .action((opts) => statsCmd(opts));

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

program.on('--help', () => {
  console.log('\nQuick start:\n  echo \'echo "hello"\' | snip add test --lang sh --tags demo\n  snip list\n  snip search hello\n  snip run test --dry-run\n');
});

program.parse(process.argv);
