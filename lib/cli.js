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

program.name('snip').version(pkg.version).description(pkg.description);

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
  .description('Remove a snippet')
  .action((idOrName) => rmCmd(idOrName));

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

const seedCmd = require('../scripts/seed-examples.js');
program
  .command('seed')
  .description('Clear all snippet data (JSON + SQLite) and add 10 example snippets')
  .action(() => seedCmd.main());

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
  } catch (_e) {}
}

program.on('--help', () => {
  console.log('\nQuick start:\n  echo \'echo "hello"\' | snip add test --lang sh --tags demo\n  snip list\n  snip search hello\n  snip run test --dry-run\n');
});

program.parse(process.argv);
