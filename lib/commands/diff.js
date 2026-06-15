/**
 * snip diff <idOrName> <versionA> <versionB> — diff two versions of a snippet
 *
 * Usage:
 *   snip diff deploy 1 3              # Diff version 1 vs version 3 of deploy
 *   snip diff deploy                  # Diff current vs previous version
 *   snip diff snippetA snippetB       # Diff two different snippets by name
 *   snip diff deploy --json           # JSON output
 */

const diff = require('../diff');
const { computeDiff } = require('../command-utils');
const { c } = require('../colors');
const icons = require('../icons');
const { log } = require('../quiet');
const { actionHint } = require('../format');
const { setExitCode } = require('../cli-utils');

async function diffCmd(idOrName, opts = {}) {
  const versionA = opts.versionA || opts.versionB || 'prev';
  const versionB = opts.versionB || 'current';

  // Use shared diff computation (also used by MCP handleDiff)
  const diffResult = computeDiff(idOrName, versionA, versionB);

  if (diffResult.error) {
    console.error(c.err(`  ${icons.cross} `) + diffResult.error);
    setExitCode(1);
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({
      snippet: diffResult.snippet.name,
      labelA: diffResult.labelA,
      labelB: diffResult.labelB,
      stats: { added: diffResult.result.added, removed: diffResult.result.removed, unchanged: diffResult.result.unchanged },
      changes: diff.formatDiffJSON(diffResult.result),
    }, null, 2));
    return;
  }

  log('');
  log(c.brand(`  ${diffResult.snippet.name}`) + c.dim(` — ${diffResult.labelA} → ${diffResult.labelB}`));
  log('');
  console.log(diff.formatDiff(diffResult.result, { labelA: diffResult.labelA, labelB: diffResult.labelB }));
  log('');
  log(actionHint([
    `snip history ${diffResult.snippet.name}:View all versions`,
    `snip undo ${diffResult.snippet.name}:Rollback`,
    `snip show ${diffResult.snippet.name}:Current`,
  ]));
}

module.exports = diffCmd;
