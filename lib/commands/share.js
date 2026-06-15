/**
 * snip share — publish snippets as public GitHub Gists.
 *
 * Usage:
 *   snip share deploy-api                    # Share one snippet → public Gist URL
 *   snip share deploy rollout rollback       # Share a pack of snippets → one Gist
 *   snip share deploy --copy                 # Copy URL to clipboard
 *   snip share deploy --json                 # JSON output
 */

const gist = require('../sync/gist');
const storage = require('../storage');
const clipboard = require('../clipboard');
const { c } = require('../colors');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');
const { getGistToken } = require('../command-utils');

async function shareCmd(names, opts = {}) {
  const { token, error: tokenError } = getGistToken();

  if (tokenError) {
    console.error(c.err('  ✗ ' + tokenError));
    setExitCode(1);
    return;
  }

  // Normalize: single name or array
  const snippetNames = Array.isArray(names) ? names : [names];
  if (snippetNames.length === 0) {
    console.error(c.err('  ✗ At least one snippet name is required'));
    console.log(c.dim('  Usage: snip share <name> [name2 name3 ...]'));
    setExitCode(2);
    return;
  }

  try {
    let result;
    let label;

    if (snippetNames.length === 1) {
      // Single snippet share — validate it exists first
      if (!storage.getSnippetByIdOrName(snippetNames[0])) {
        console.error(c.err(`  ✗ Snippet not found: "${snippetNames[0]}"`));
        setExitCode(1);
        return;
      }
      result = await gist.shareSnippet(snippetNames[0], token);
      label = snippetNames[0];
    } else {
      // Pack share — validate all snippets exist first
      const missing = [];
      for (const n of snippetNames) {
        if (!storage.getSnippetByIdOrName(n)) missing.push(n);
      }
      if (missing.length > 0) {
        console.error(c.err(`  ✗ Snippets not found: ${missing.join(', ')}`));
        setExitCode(1);
        return;
      }
      result = await gist.sharePack(snippetNames, token);
      label = `${snippetNames.length} snippets`;
    }

    const gistUrl = result.html_url || `https://gist.github.com/${result.id}`;

    if (opts.json) {
      console.log(JSON.stringify({
        url: gistUrl,
        gistId: result.id,
        description: result.description,
        files: Object.keys(result.files || {}),
        public: true,
      }, null, 2));
      return;
    }

    log('');
    log(c.success(`  ✓ Published ${label} as public Gist`));
    log(c.dim(`  ${gistUrl}`));
    log('');

    // Optionally copy URL to clipboard
    if (opts.copy) {
      const cpResult = clipboard.copyText(gistUrl);
      if (cpResult.ok) {
        log(c.dim(`  Copied URL to clipboard (${cpResult.command})`));
      } else {
        log(c.muted('  Tip: Select and copy the URL above'));
      }
    }

    log(c.dim('  Others can import with:'));
    log(c.code(`  snip sync pull ${result.id}`));
    log('');

  } catch (e) {
    console.error(c.err(`  ✗ Share failed: ${e.message}`));
    setExitCode(1);
  }
}

async function unshareCmd(name, opts = {}) {
  const { token, error: tokenError } = getGistToken();

  if (tokenError) {
    console.error(c.err('  ✗ ' + tokenError));
    setExitCode(1);
    return;
  }

  if (!name) {
    console.error(c.err('  ✗ Snippet name is required'));
    console.log(c.dim('  Usage: snip unshare <name>'));
    setExitCode(2);
    return;
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    console.error(c.err(`  ✗ Snippet not found: "${name}"`));
    setExitCode(1);
    return;
  }

  const gistId = snippet.origin && snippet.origin.gistId;
  if (!gistId) {
    console.error(c.err(`  ✗ Snippet "${name}" has no shared Gist to unpublish`));
    log(c.dim('  Share it first with:'));
    log(c.code(`  snip share ${name}`));
    process.exitCode = 1;
    return;
  }

  try {
    await gist.deleteGist(gistId, token);

    // Clear the origin data
    storage.setSnippetOrigin(snippet.id, {});

    if (opts.json) {
      console.log(JSON.stringify({
        unpublished: true,
        snippet: snippet.name,
        gistId: gistId,
      }, null, 2));
      return;
    }

    log('');
    log(c.success(`  ✓ Unpublished "${snippet.name}" — Gist ${gistId} deleted`));
    log(c.dim('  The snippet remains in your local library.'));
    log('');

  } catch (e) {
    console.error(c.err(`  ✗ Unpublish failed: ${e.message}`));
    setExitCode(1);
  }
}

module.exports = { shareCmd, unshareCmd };

