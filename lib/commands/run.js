const storage = require('../storage');
const exec = require('../exec');
const config = require('../config');
const template = require('../template');
const { c } = require('../colors');
const { question } = require('../readline');
const { stripAnsi } = require('../format');
const { log, isQuiet } = require('../quiet');
const { setExitCode } = require('../cli-utils');
const safety = require('../safety');
const search = require('../search');

async function run(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(c.err(`  ✗ Snippet not found: `) + c.brand(`"${idOrName}"`));
    const suggestions = search.suggestSimilar(idOrName, 3);
    if (suggestions.length) console.error(c.muted(`  Did you mean: ${suggestions.join(', ')}?`));
    setExitCode(1);
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
      setExitCode(2);
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
      setExitCode(1);
      return;
    }
    console.log('');
  }

  // ── Preview header with box drawing ──
  const cols = Math.min(process.stdout.columns || 80, 72);
  log('');
  log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));
  const previewStr = ' ' + c.brand(icons.run + ' Preview ') + c.dim('(' + runner.command + ')');
  const previewPadding = Math.max(0, cols - 2 - stripAnsi(previewStr).length - 1);
  log(c.border('  │') + previewStr + ' '.repeat(previewPadding) + c.border('│'));
  log(c.border('  ├' + '─'.repeat(cols - 2) + '┤'));
  
  // Content — data output
  const contentLines = content.split('\n');
  contentLines.slice(0, 20).forEach(line => {
    const safeLine = ' ' + c.code(line || '');
    const linePadding = Math.max(0, cols - 2 - stripAnsi(safeLine).length - 1);
    console.log(c.border('  │') + safeLine + ' '.repeat(linePadding) + c.border('│'));
  });
  if (contentLines.length > 20) {
    const truncLine = c.muted('  ... (' + contentLines.length + ' lines total)');
    const truncPadding = Math.max(0, cols - 2 - stripAnsi(truncLine).length - 1);
    log(c.border('  │') + truncLine + ' '.repeat(truncPadding) + c.border('│'));
  }
  log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));
  log('');

  if (opts['dryRun']) {
    exec.runSnippetContent(content, { dryRun: true });
    return;
  }

  const doConfirm = cfg.confirmRun && !opts.confirm;
  if (doConfirm && !isQuiet()) {
    const ans = await question(c.brand('  ' + icons.run + ' Run snippet? ') + c.dim('[Y/n]: '));
    if (ans !== '' && !['y', 'Y', 'yes'].includes(ans)) {
      log(c.muted('  Aborted.'));
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
  setExitCode(status);
}

module.exports = run;
