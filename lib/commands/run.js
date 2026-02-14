const storage = require('../storage');
const exec = require('../exec');
const config = require('../config');

function run(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  const content = storage.readSnippetContent(s);
  console.log('--- Preview ---');
  console.log(content);
  const cfg = config.loadConfig();
  const doConfirm = cfg.confirmRun && !opts.confirm;
  const safety = require('../safety');
  if (safety.isDangerous(content)) {
    console.error('Warning: snippet contains potentially dangerous commands. Aborting. Use --confirm to override.');
    if (!opts.confirm) return process.exitCode = 2;
  }
  if (opts['dryRun']) return exec.runSnippetContent(content, { dryRun: true });
  if (doConfirm) {
    const readline = require('readline-sync');
    const ans = readline.question('Run snippet? (y/N): ');
    if (!['y', 'Y', 'yes'].includes(ans)) return console.log('Aborted');
  }
  const status = exec.runSnippetContent(content, { dryRun: false, shell: cfg.defaultShell });
  if (status === 0) storage.touchUsage(s);
  process.exitCode = status;
}

module.exports = run;
