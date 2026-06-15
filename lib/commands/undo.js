/**
 * snip undo <idOrName> — rollback a snippet to its previous version
 *
 * Usage:
 *   snip undo deploy              # Rollback deploy to previous version
 *   snip undo deploy --version 1  # Rollback to a specific version
 *   snip undo deploy --json       # JSON output
 */

const storage = require('../storage');
const versions = require('../versions');
const { c } = require('../colors');
const icons = require('../icons');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');

function undo(idOrName, opts = {}) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(c.err(`  ${icons.cross} Snippet not found: `) + c.brand(`"${idOrName}"`));
    setExitCode(1);
    return;
  }

  const allVersions = versions.listVersions(s.id);

  if (allVersions.length === 0) {
    log(c.muted('  No version history for this snippet. Nothing to undo.'));
    return;
  }

  let result;

  if (opts.rev !== undefined) {
    // Rollback to a specific version
    const targetVersion = parseInt(opts.rev);
    if (isNaN(targetVersion)) {
      console.error(c.err('  Invalid version number: ') + c.brand(opts.rev));
      setExitCode(1);
      return;
    }

    const targetContent = versions.getVersionContent(s.id, targetVersion);
    if (targetContent === null) {
      console.error(c.err('  Version not found: ') + c.brand(`v${targetVersion}`));
      setExitCode(1);
      return;
    }

    // Save current as snapshot first
    versions.saveVersion(s.id, 'Before rollback');
    storage.updateSnippetContent(s.id, targetContent);
    result = { content: targetContent, version: targetVersion, previousVersion: versions.getLatestVersion(s.id) };
  } else {
    // Rollback to previous version
    result = versions.undo(s.id);
  }

  if (!result) {
    log(c.muted('  Nothing to undo — only one version available.'));
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({
      snippet: s.name,
      restoredVersion: result.version,
      previousVersion: result.previousVersion,
      content: result.content,
    }, null, 2));
    return;
  }

  log('');
  log(c.success(`  ${icons.check} Restored ${c.brand(s.name)} to version ${c.brand('v' + result.version)}`));
  log('');
  log(c.dim('  Run snip show ' + s.name + ' to see the restored content.'));
  log(c.dim('  Run snip history ' + s.name + ' to see all versions.'));
}

module.exports = undo;
