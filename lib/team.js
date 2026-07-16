/**
 * lib/team.js — Team workspace snippet management
 *
 * Manages a JSON file (default: .snip/snippets.json in the repo root)
 * that can be checked into version control and shared across a team.
 *
 * File format:
 *   {
 *     "workspace": "my-project",
 *     "version": 1,
 *     "snippets": [
 *       {
 *         "name": "db-backup",
 *         "content": "pg_dump ...",
 *         "language": "sh",
 *         "tags": ["database", "postgres"],
 *         "author": "jane (git config user.name)",
 *         "updatedAt": "2026-06-14T..."
 *       }
 *     ]
 *   }
 *
 * API:
 *   detectTeamDir(dir)         — Find .snip/ directory, looking upward
 *   readTeamFile(dir)          — Read and parse .snip/snippets.json
 *   writeTeamFile(dir, data)   — Write snippets to team file
 *   addToTeam(dir, snippet)    — Add snippet to team file
 *   listTeam(dir)              — List snippets from team file
 *   getTeamMergeStatus(dir)    — Compare team vs local, return diff
 *   syncFromTeam(dir)          — Import all team snippets into local storage
 *   pushToTeam(dir, ids)       — Export local snippets back to team file
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const storage = require('./storage');

const TEAM_DIR_NAME = '.snip';
const TEAM_FILE_NAME = 'snippets.json';
const WORKSPACE_TAG_PREFIX = 'workspace:';

/**
 * Find the team .snip/ directory, searching upward from cwd.
 * @param {string} [dir] - Directory to start searching from
 * @returns {string|null} Absolute path to team dir, or null
 */
function detectTeamDir(dir) {
  const startDir = dir || process.cwd();
  let current = path.resolve(startDir);

  // Check config first for explicit teamDir
  const cfg = config.loadConfig();
  if (cfg.teamDir) {
    const explicit = path.resolve(cfg.teamDir);
    if (fs.existsSync(explicit) && fs.statSync(explicit).isDirectory()) {
      return explicit;
    }
  }

  // Walk up looking for .snip/ directory
  const root = path.parse(current).root;
  while (true) {
    const candidate = path.join(current, TEAM_DIR_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    if (current === root) break;
    current = path.dirname(current);
  }

  return null;
}

/**
 * Get the path to the team snippets file.
 * @param {string} teamDir - Path to .snip/ directory
 * @returns {string}
 */
function teamFilePath(teamDir) {
  return path.join(teamDir, TEAM_FILE_NAME);
}

/**
 * Read the team snippet file.
 * @param {string} dir - Directory containing .snip/ (or null to auto-detect)
 * @returns {{ workspace: string, version: number, snippets: Array }|null}
 */
function readTeamFile(dir) {
  const teamDir = dir ? path.join(path.resolve(dir), TEAM_DIR_NAME) : detectTeamDir();
  if (!teamDir) return null;

  const filePath = teamFilePath(teamDir);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.snippets || !Array.isArray(data.snippets)) return null;
    return {
      workspace: data.workspace || path.basename(path.dirname(teamDir)),
      version: data.version || 1,
      snippets: data.snippets,
    };
  } catch {
    return null;
  }
}

/**
 * Write snippets to the team file.
 * @param {string} teamDir - Path to .snip/ directory
 * @param {object} data - { workspace, version, snippets }
 */
function writeTeamFile(teamDir, data) {
  if (!fs.existsSync(teamDir)) {
    fs.mkdirSync(teamDir, { recursive: true });
  }
  const filePath = teamFilePath(teamDir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Get the workspace name from a team dir.
 * @param {string} teamDir 
 * @returns {string}
 */
function getWorkspaceName(teamDir) {
  return path.basename(path.dirname(teamDir));
}

/**
 * Add a snippet to the team file.
 * @param {string} dir - Directory to place .snip/ in
 * @param {object} snippet - { name, content, language, tags }
 * @returns {{ workspace: string, snippet: object }}
 */
function addToTeam(dir, snippet) {
  const teamDir = path.join(path.resolve(dir), TEAM_DIR_NAME);
  const data = readTeamFile(path.dirname(teamDir)) || {
    workspace: path.basename(path.resolve(dir)),
    version: 1,
    snippets: [],
  };

  const author = getGitUser();
  const now = new Date().toISOString();

  const entry = {
    name: snippet.name,
    content: snippet.content,
    language: snippet.language || '',
    tags: snippet.tags || [],
    author: author || 'unknown',
    updatedAt: now,
  };

  // Replace existing entry with same name
  const existingIdx = data.snippets.findIndex(s => s.name === snippet.name);
  if (existingIdx >= 0) {
    data.snippets[existingIdx] = { ...data.snippets[existingIdx], ...entry, updatedAt: now };
  } else {
    data.snippets.push(entry);
  }

  data.workspace = data.workspace || path.basename(path.resolve(dir));
  data.version = (data.version || 0) + 1;

  writeTeamFile(teamDir, data);
  return { workspace: data.workspace, snippet: entry };
}

/**
 * List all snippets from the team file.
 * @param {string} [dir] - Directory to search from
 * @returns {Array|null}
 */
function listTeam(dir) {
  const data = readTeamFile(dir);
  if (!data) return null;
  return data.snippets;
}

/**
 * Import all team snippets into local storage.
 * Each snippet gets tagged with workspace:<name> so it can be identified.
 * @param {string} [dir] - Directory to search from
 * @returns {{ imported: number, skipped: number, workspace: string }}
 */
function syncFromTeam(dir) {
  const data = readTeamFile(dir);
  if (!data) return { imported: 0, skipped: 0, workspace: 'unknown' };

  let imported = 0;
  let skipped = 0;

  for (const teamSnip of data.snippets) {
    // Skip if already exists with this workspace origin
    const existing = storage.getSnippetByIdOrName(teamSnip.name);
    if (existing) {
      const existingTags = existing.tags || [];
      const wsTag = `${WORKSPACE_TAG_PREFIX}${data.workspace}`;
      if (existingTags.includes(wsTag)) {
        // Already synced — update content if team version is newer
        if (existing.updatedAt && teamSnip.updatedAt && teamSnip.updatedAt > existing.updatedAt) {
          storage.updateSnippetContent(existing.id, teamSnip.content);
          imported++;
        } else {
          skipped++;
        }
        continue;
      }
      // Exists but not from this workspace — skip to avoid overwrite
      skipped++;
      continue;
    }

    const tags = [...(teamSnip.tags || []), `${WORKSPACE_TAG_PREFIX}${data.workspace}`];
    try {
      storage.addSnippet({
        name: teamSnip.name,
        content: teamSnip.content,
        language: teamSnip.language || '',
        tags,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped, workspace: data.workspace };
}

/**
 * Export local snippets tagged with a workspace back to the team file.
 * @param {string} dir - Target directory for .snip/
 * @param {object} opts
 * @param {string} opts.workspace - Only export snippets for this workspace
 * @returns {{ pushed: number, workspace: string }}
 */
function pushToTeam(dir, opts = {}) {
  const teamDir = path.join(path.resolve(dir), TEAM_DIR_NAME);
  const workspace = opts.workspace || path.basename(path.resolve(dir));

  // Find local snippets tagged with this workspace
  const allLocal = storage.listSnippets();
  const workspaceTag = `${WORKSPACE_TAG_PREFIX}${workspace}`;
  const teamSnippets = allLocal.filter(s => (s.tags || []).includes(workspaceTag));

  const data = {
    workspace,
    version: (readTeamFile(path.dirname(teamDir))?.version || 0) + 1,
    snippets: teamSnippets.map(s => ({
      name: s.name,
      content: storage.readSnippetContent(s),
      language: s.language || '',
      tags: (s.tags || []).filter(t => !t.startsWith(WORKSPACE_TAG_PREFIX)),
      author: getGitUser() || 'unknown',
      updatedAt: new Date().toISOString(),
    })),
  };

  writeTeamFile(teamDir, data);
  return { pushed: data.snippets.length, workspace };
}

/**
 * Create a new team workspace: init .snip/ directory with empty snippets file.
 * @param {string} dir - Target directory
 * @param {string} [workspaceName] - Optional workspace name (defaults to dir name)
 * @returns {{ teamDir: string, workspace: string }}
 */
function initTeamDir(dir, workspaceName) {
  const teamDir = path.join(path.resolve(dir), TEAM_DIR_NAME);
  const workspace = workspaceName || path.basename(path.resolve(dir));

  if (!readTeamFile(path.dirname(teamDir))) {
    writeTeamFile(teamDir, { workspace, version: 1, snippets: [] });
  }

  const policyFile = path.join(teamDir, 'policy.json');
  if (!fs.existsSync(policyFile)) {
    fs.writeFileSync(policyFile, JSON.stringify({
      deny: [],
      allow: [],
      allowedLanguages: null,
      execRequiresApproval: false,
      maxRuntimeMs: null,
    }, null, 2) + '\n');
  }

  const readmeFile = path.join(teamDir, 'README.md');
  if (!fs.existsSync(readmeFile)) {
    fs.writeFileSync(readmeFile, [
      `# ${workspace} runbook`,
      '',
      'Verified commands for this repo, usable by humans (`snip`) and AI agents (MCP).',
      '',
      '- `snippets.json` — the team command library. Add via `snip team add <name>`, review changes in PRs.',
      '- `policy.json` — execution guardrails for agents (deny/allow patterns, approval gate, max runtime).',
      '',
      'Git is the sync backend: no server, data stays in your repo.',
      '',
    ].join('\n'));
  }

  return { teamDir, workspace };
}

/**
 * Compare team snippets vs local storage and return diff status.
 * @param {string} [dir]
 * @returns {{ inTeam: Array, inLocal: Array, missingLocal: Array, missingTeam: Array, workspace: string }}
 */
function getTeamMergeStatus(dir) {
  const data = readTeamFile(dir);
  if (!data) {
    return { inTeam: [], inLocal: [], missingLocal: [], missingTeam: [], workspace: 'unknown' };
  }

  const allLocal = storage.listSnippets();
  const workspaceTag = `${WORKSPACE_TAG_PREFIX}${data.workspace}`;
  const localFromTeam = allLocal.filter(s => (s.tags || []).includes(workspaceTag));

  const teamNames = new Set(data.snippets.map(s => s.name));
  const localTeamNames = new Set(localFromTeam.map(s => s.name));

  const missingLocal = data.snippets.filter(s => !localTeamNames.has(s.name));
  const missingTeam = localFromTeam.filter(s => !teamNames.has(s.name));

  return {
    inTeam: data.snippets,
    inLocal: localFromTeam,
    missingLocal,
    missingTeam,
    workspace: data.workspace,
  };
}

/**
 * Get the git user name for attribution.
 * @returns {string|null}
 */
function getGitUser() {
  try {
    const { spawnSync } = require('child_process');
    const res = spawnSync('git', ['config', 'user.name'], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch { /* */ }
  return null;
}

module.exports = {
  detectTeamDir,
  readTeamFile,
  writeTeamFile,
  getWorkspaceName,
  addToTeam,
  listTeam,
  syncFromTeam,
  pushToTeam,
  initTeamDir,
  getTeamMergeStatus,
  WORKSPACE_TAG_PREFIX,
  TEAM_DIR_NAME,
  TEAM_FILE_NAME,
};
