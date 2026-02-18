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
  .enablePositionalOptions();

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
  .option('--json', 'Output as JSON')
  .action((opts) => listCmd(opts));

program
  .command('search <query>')
  .description('Fuzzy search snippets')
  .action((q) => searchCmd(q));

program
  .command('show <idOrName>')
  .description('Show snippet content')
  .option('--edit', 'Open in editor')
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

program
  .command('stats')
  .description('Show snippet library statistics')
  .action(() => {
    const storage = require('./storage');
    const all = storage.listSnippets();
    const langMap = {};
    let totalUsage = 0;
    let mostUsed = null;
    for (const s of all) {
      const lang = s.language || 'unknown';
      langMap[lang] = (langMap[lang] || 0) + 1;
      totalUsage += s.usageCount || 0;
      if (!mostUsed || (s.usageCount || 0) > (mostUsed.usageCount || 0)) mostUsed = s;
    }
    console.log(`\n  Snippets:  ${all.length}`);
    console.log(`  Total runs: ${totalUsage}`);
    if (mostUsed && mostUsed.usageCount) {
      console.log(`  Most used:  ${mostUsed.name} (${mostUsed.usageCount} runs)`);
    }
    const langs = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
    if (langs.length) {
      console.log(`  Languages:  ${langs.map(([l, c]) => `${l} (${c})`).join(', ')}`);
    }
    console.log('');
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
