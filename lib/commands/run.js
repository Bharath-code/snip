const storage = require('../storage');
const exec = require('../exec');
const config = require('../config');
const template = require('../template');
const { c } = require('../colors');
const { question } = require('../readline');
const safety = require('../safety');
const search = require('../search');

async function run(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(`Snippet not found: "${idOrName}"`);
    const suggestions = search.suggestSimilar(idOrName, 3);
    if (suggestions.length) console.error(`  Did you mean: ${suggestions.join(', ')}? Try: snip search "${idOrName}"`);
    process.exitCode = 1;
    return;
  }
  let content = storage.readSnippetContent(s);
  const cfg = config.loadConfig();
  const runner = exec.resolveRunner(s.language, cfg.defaultShell);

  // F1: Always check for danger; --confirm only skips "Run snippet?" prompt, never danger check
  if (safety.isDangerous(content)) {
    console.error(c.err('\n  ╔══════════════════════════════════════════╗'));
    console.error(c.err('  ║  ⚠  DANGEROUS COMMAND DETECTED           ║'));
    console.error(c.err('  ╚══════════════════════════════════════════╝\n'));
    const confirmed = await safety.confirmDangerous(content);
    if (!confirmed) {
      console.log('Aborted.');
      process.exitCode = 2;
      return;
    }
  }

  // Resolve template variables if present
  if (template.hasVariables(content)) {
    const vars = template.extractVariables(content);
    console.log(`\n  This snippet has ${vars.length} variable${vars.length > 1 ? 's' : ''}:\n`);
    try {
      content = await template.promptAndInterpolate(content);
    } catch (e) {
      console.error(e.message || 'Aborted.');
      process.exitCode = 1;
      return;
    }
    console.log('');
  }

  // U1: Colored preview header
  console.log(c.accent(`\n  ─── Preview (${runner.command}) ───`));
  console.log(c.dim(content));
  console.log('');

  if (opts['dryRun']) {
    exec.runSnippetContent(content, { dryRun: true });
    return;
  }

  const doConfirm = cfg.confirmRun && !opts.confirm;
  if (doConfirm) {
    const ans = await question(c.accent('  Run snippet? [Y/n]: '));
    if (ans !== '' && !['y', 'Y', 'yes'].includes(ans)) {
      console.log('Aborted.');
      return;
    }
  }

  const status = exec.runSnippetContent(content, {
    dryRun: false,
    shell: cfg.defaultShell,
    language: s.language
  });
  if (status === 0) {
    storage.touchUsage(s);
    require('./last').setLastRun(s.id);
    require('../streak').recordUsage();
  }
  process.exitCode = status;
}

module.exports = run;
