const storage = require('../storage');
const exec = require('../exec');
const config = require('../config');
const template = require('../template');

// U1/U2: Colored output helpers (graceful fallback if chalk unavailable)
let chalk = null;
try {
  const m = require('chalk');
  chalk = (m && m.default) ? m.default : m;
} catch (_) { }
const c = {
  accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  dim: (t) => chalk ? chalk.dim(t) : t,
  warn: (t) => chalk ? chalk.yellow.bold(t) : t,
  err: (t) => chalk ? chalk.red.bold(t) : t,
  success: (t) => chalk ? chalk.green(t) : t,
};

function run(idOrName, opts) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  let content = storage.readSnippetContent(s);
  const cfg = config.loadConfig();
  const runner = exec.resolveRunner(s.language, cfg.defaultShell);
  const safety = require('../safety');

  // F1: Check raw content for danger BEFORE prompting for variables
  if (safety.isDangerous(content)) {
    console.error(c.err('\n  ╔══════════════════════════════════════════╗'));
    console.error(c.err('  ║  ⚠  DANGEROUS COMMAND DETECTED           ║'));
    console.error(c.err('  ╚══════════════════════════════════════════╝\n'));
    if (!opts.confirm) {
      // S2: Always require explicit interactive confirmation for dangerous commands
      const confirmed = safety.confirmDangerous(content);
      if (!confirmed) {
        console.log('Aborted.');
        return process.exitCode = 2;
      }
    }
  }

  // Resolve template variables if present
  if (template.hasVariables(content)) {
    const vars = template.extractVariables(content);
    console.log(`\n  This snippet has ${vars.length} variable${vars.length > 1 ? 's' : ''}:\n`);
    content = template.promptAndInterpolate(content);
    console.log('');
  }

  // U1: Colored preview header
  console.log(c.accent(`\n  ─── Preview (${runner.command}) ───`));
  console.log(c.dim(content));
  console.log('');

  if (opts['dryRun']) return exec.runSnippetContent(content, { dryRun: true });

  const doConfirm = cfg.confirmRun && !opts.confirm;
  if (doConfirm) {
    const readline = require('readline-sync');
    // X1: Accept Enter (empty) as "yes"
    const ans = readline.question(c.accent('  Run snippet? [Y/n]: '));
    if (ans !== '' && !['y', 'Y', 'yes'].includes(ans)) return console.log('Aborted.');
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
