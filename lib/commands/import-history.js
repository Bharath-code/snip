/**
 * snip import-history — analyze shell history and suggest commands run 3+ times.
 * Usage: snip import-history [--last N] [--min-count M]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { c } = require('../colors');

const DEFAULT_LAST = 500;
const MIN_COUNT = 3;
const MIN_CMD_LEN = 4;

function getHistoryPath() {
  const histfile = process.env.HISTFILE;
  if (histfile && fs.existsSync(histfile)) return histfile;
  const shell = (process.env.SHELL || '').toLowerCase();
  const home = os.homedir();
  if (shell.includes('zsh')) return path.join(home, '.zsh_history');
  if (shell.includes('bash')) return path.join(home, '.bash_history');
  return path.join(home, '.zsh_history');
}

function parseZshLine(line) {
  const m = line.match(/^: \d+:\d+;(.*)/);
  return m ? m[1].trim() : line.trim();
}

function parseBashLine(line) {
  return line.trim();
}

function importHistoryCmd(opts = {}) {
  const last = Math.min(Math.max(1, parseInt(opts.last) || DEFAULT_LAST), 10000);
  const minCount = Math.max(2, parseInt(opts.minCount) || MIN_COUNT);
  const histPath = getHistoryPath();

  if (!fs.existsSync(histPath)) {
    console.error(`History file not found: ${histPath}`);
    console.error('Set HISTFILE or use bash/zsh with default history path.');
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(histPath, 'utf8');
  const isZsh = histPath.includes('zsh_history');
  const lines = raw.split('\n').slice(-last).map(l => isZsh ? parseZshLine(l) : parseBashLine(l));
  const countByCmd = {};
  for (const line of lines) {
    const cmd = line.trim();
    if (cmd.length < MIN_CMD_LEN) continue;
    countByCmd[cmd] = (countByCmd[cmd] || 0) + 1;
  }
  const suggested = Object.entries(countByCmd)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  if (opts.json) {
    console.log(JSON.stringify(suggested.map(([cmd, n]) => ({ command: cmd, count: n })), null, 2));
    return;
  }

  if (suggested.length === 0) {
    console.log(c.muted(`No commands run ${minCount}+ times in the last ${last} history lines.`));
    console.log(c.dim('  Try --last 1000 or --min-count 2'));
    return;
  }

  console.log(c.accent(`\n  Commands run ${minCount}+ times (from last ${last} history lines):\n`));
  suggested.forEach(([cmd, n], i) => {
    const preview = cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd;
    console.log(`  ${(i + 1).toString().padStart(2)}. ${c.val(n + '×')} ${c.dim(preview)}`);
  });
  console.log(c.dim('\n  Add one: snip add <name> (then paste the command, or use snip grab)'));
  console.log('');
}

module.exports = importHistoryCmd;
