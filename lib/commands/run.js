const storage = require('../storage');
const exec = require('../exec');
const config = require('../config');
const template = require('../template');

function run(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  let content = storage.readSnippetContent(s);
  const cfg = config.loadConfig();
  const runner = exec.resolveRunner(s.language, cfg.defaultShell);

  // Resolve template variables if present
  if (template.hasVariables(content)) {
    const vars = template.extractVariables(content);
    console.log(`\n  This snippet has ${vars.length} variable${vars.length > 1 ? 's' : ''}:\n`);
    content = template.promptAndInterpolate(content);
    console.log('');
  }

  console.log(`--- Preview (${runner.command}) ---`);
  console.log(content);
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
  const status = exec.runSnippetContent(content, {
    dryRun: false,
    shell: cfg.defaultShell,
    language: s.language
  });
  if (status === 0) storage.touchUsage(s);
  process.exitCode = status;
}

module.exports = run;
