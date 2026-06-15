/**
 * lib/command-utils.js — Shared business logic for CLI commands and MCP handlers.
 *
 * Extracts duplicated logic from:
 *   - lib/commands/add.js + lib/mcp-server.js handleSave (auto-tagging)
 *   - lib/commands/diff.js + lib/mcp-server.js handleDiff (version resolution)
 *   - lib/commands/share.js + lib/mcp-server.js handleShare/handleUnshare (token validation)
 *   - lib/commands/discover.js + lib/mcp-server.js handleDiscover (token validation)
 */

const storage = require('./storage');
const config = require('./config');
const context = require('./context');
const versions = require('./versions');
const diff = require('./diff');

// ── Auto-tagging ─────────────────────────────────────────────────

/**
 * Compute auto-tags based on project context.
 * Used by both `snip add` (CLI) and `snip_save` (MCP).
 *
 * @param {string[]} userTags - Tags explicitly provided by the user
 * @returns {{ allTags: string[], ctx: object }} Combined tags and context info
 */
function autoTagSnippet(userTags) {
  const tags = Array.isArray(userTags) ? userTags : [];
  const ctx = context.detectContext();
  const autoTags = [];

  for (const ctxTag of ctx.tags) {
    if (!tags.includes(ctxTag)) {
      autoTags.push(ctxTag);
    }
  }

  const projectTag = 'ctx:' + ctx.projectName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  if (!tags.includes(projectTag) && !autoTags.includes(projectTag) && ctx.projectName !== 'unknown') {
    autoTags.push(projectTag);
  }

  return {
    allTags: [...tags, ...autoTags],
    ctx,
  };
}

// ── Version resolution ───────────────────────────────────────────

/**
 * Resolve a version label ("prev", "current", or a number) to content + label.
 * Used by both `snip diff` (CLI) and `snip_diff` (MCP).
 *
 * @param {object} snippet - Snippet object from storage
 * @param {string} versionLabel - "prev", "current", or a version number string
 * @param {object[]} allVersions - Array from versions.listVersions()
 * @returns {{ content: string|null, label: string }|null}
 */
function resolveVersion(snippet, versionLabel, allVersions) {
  if (!allVersions || allVersions.length === 0) return null;

  const latestVersion = allVersions[allVersions.length - 1];

  if (versionLabel === 'current') {
    return {
      content: storage.readSnippetContent(snippet),
      label: `current (v${latestVersion.version || '?'})`,
    };
  }

  if (versionLabel === 'prev') {
    const prev = allVersions[allVersions.length - 1];
    return {
      content: versions.getVersionContent(snippet.id, prev.version),
      label: `v${prev.version}`,
    };
  }

  const v = parseInt(versionLabel);
  if (isNaN(v)) return null;

  return {
    content: versions.getVersionContent(snippet.id, v),
    label: `v${v}`,
  };
}

/**
 * Compute a diff between two version labels of a snippet.
 * Used by both `snip diff` (CLI) and `snip_diff` (MCP).
 *
 * @param {string} idOrName - Snippet name or ID
 * @param {string} versionALabel - First version label
 * @param {string} versionBLabel - Second version label
 * @returns {{ snippet, labelA, labelB, result, error }|{ error: string }}
 */
function computeDiff(idOrName, versionALabel, versionBLabel) {
  const snippet = storage.getSnippetByIdOrName(idOrName);
  if (!snippet) return { error: `Snippet not found: "${idOrName}"` };

  const allVersions = versions.listVersions(snippet.id);
  if (allVersions.length === 0) return { error: 'No version history for this snippet.' };

  const resolvedA = resolveVersion(snippet, versionALabel, allVersions);
  const resolvedB = resolveVersion(snippet, versionBLabel, allVersions);

  if (!resolvedA || resolvedA.content === null) return { error: `Version "${versionALabel}" not found.` };
  if (!resolvedB || resolvedB.content === null) return { error: `Version "${versionBLabel}" not found.` };

  const result = diff.diffLines(resolvedA.content, resolvedB.content);

  return {
    snippet,
    labelA: `${snippet.name}@${resolvedA.label}`,
    labelB: `${snippet.name}@${resolvedB.label}`,
    result,
  };
}

// ── Token validation ─────────────────────────────────────────────

/**
 * Get and validate the GitHub Gist token.
 * Used by share, unshare, and discover commands.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.required=true] - Whether token is required (discover --recent works without)
 * @returns {{ token: string|null, error: string|null }}
 */
function getGistToken(opts = {}) {
  const cfg = config.loadConfig();
  const token = cfg.gist_token || null;

  if (opts.required !== false && !token) {
    return {
      token: null,
      error: 'GitHub token not configured. Set SNIP_GIST_TOKEN env var or run: snip config set gist_token <your-token>',
    };
  }

  return { token, error: null };
}

module.exports = {
  autoTagSnippet,
  resolveVersion,
  computeDiff,
  getGistToken,
};
