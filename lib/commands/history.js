/**
 * snip history <idOrName> — show version history of a snippet
 *
 * Usage:
 *   snip history deploy          # Show version timeline
 *   snip history deploy --json   # JSON output
 *   snip history deploy --limit 10   # Show last N versions
 */

const storage = require('../storage');
const versions = require('../versions');
const { c } = require('../colors');
const icons = require('../icons');
const { log, isQuiet } = require('../quiet');
const { actionHint, stripAnsi } = require('../format');
const { setExitCode } = require('../cli-utils');

function history(idOrName, opts = {}) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(c.err(`  ${icons.cross} Snippet not found: `) + c.brand(`"${idOrName}"`));
    setExitCode(1);
    return;
  }

  const allVersions = versions.listVersions(s.id);

  if (allVersions.length === 0) {
    log(c.muted('  No version history for this snippet yet.'));
    log(c.dim('  Versions are created automatically when you edit a snippet.'));
    return;
  }

  const limit = Math.min(parseInt(opts.limit) || allVersions.length, 50);
  const displayVersions = allVersions.slice(-limit);

  if (opts.json) {
    console.log(JSON.stringify({
      snippet: s.name,
      snippetId: s.id,
      currentVersion: versions.getLatestVersion(s.id),
      totalVersions: allVersions.length,
      versions: displayVersions.reverse().map(v => ({
        version: v.version,
        timestamp: v.timestamp,
        message: v.message,
        date: new Date(v.timestamp).toLocaleString(),
      })),
    }, null, 2));
    return;
  }

  // Terminal output
  log('');
  log(c.brand(`  ${icons.edit} ${s.name}`) + c.muted(` · ${allVersions.length} versions`));
  log('');

  // List versions in reverse chronological order (newest first)
  const reversed = [...displayVersions].reverse();
  for (const v of reversed) {
    const date = new Date(v.timestamp).toLocaleString();
    const versionStr = c.brand(`v${v.version}`);
    const dateStr = c.muted(date);
    const msgStr = v.message ? c.dim(` — ${v.message}`) : '';
    log(`  ${versionStr}  ${dateStr}${msgStr}`);
  }

  log('');
  log(actionHint([
    `snip show ${s.name}:Current version`,
    `snip show ${s.name} --version LATEST:Specific version`,
    `snip diff ${s.name} v1 v${reversed.length}:Diff versions`,
    `snip undo ${s.name}:Rollback`,
  ]));
}

module.exports = history;
