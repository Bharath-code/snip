/**
 * snip packs — community snippet pack registry.
 *
 * Packs are JSON manifests hosted on GitHub. Each pack contains a set of
 * curated snippets for a specific topic (Docker, Kubernetes, Git, etc.).
 *
 * Registry URL pattern:
 *   https://raw.githubusercontent.com/snip-packs/<name>/main/pack.json
 *
 * A pack.json has the shape:
 *   { "name": "...", "version": "...", "description": "...", "snippets": [...] }
 */

const storage = require('./storage');

const REGISTRY_BASE = 'https://raw.githubusercontent.com/snip-packs';
const DEFAULT_BRANCH = 'main';
const MANIFEST_FILE = 'pack.json';

/**
 * Built-in pack index — packs known to exist in the registry.
 * This is a curated list, not exhaustive (the registry may have more).
 */
const BUILTIN_PACKS = [
  {
    name: 'docker-essentials',
    description: 'Essential Docker commands: containers, images, volumes, networks, cleanup',
    snippetCount: 6,
  },
  {
    name: 'git-workflow',
    description: 'Common Git operations: commit, branch, merge, rebase, stash, log',
    snippetCount: 8,
  },
  {
    name: 'k8s-quick',
    description: 'Kubernetes quick commands: pods, deployments, services, logs, port-forward',
    snippetCount: 5,
  },
  {
    name: 'node-dev',
    description: 'Node.js development helpers: npm, npx, debug, test, build',
    snippetCount: 5,
  },
  {
    name: 'linux-ops',
    description: 'Linux operations: disk, memory, process, network diagnostics',
    snippetCount: 6,
  },
  {
    name: 'python-dev',
    description: 'Python dev essentials: venv, pip, pytest, lint, build',
    snippetCount: 5,
  },
];

/**
 * Resolve the manifest URL for a given pack name.
 */
function manifestUrl(name) {
  return `${REGISTRY_BASE}/${encodeURIComponent(name)}/${DEFAULT_BRANCH}/${MANIFEST_FILE}`;
}

/**
 * Fetch a pack manifest from the registry.
 * Returns the parsed JSON on success, or throws on error.
 *
 * @param {string} name - Pack name (e.g. "docker-essentials")
 * @returns {Promise<{name: string, version: string, description: string, snippets: Array}>}
 */
async function fetchPack(name) {
  const url = manifestUrl(name);
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Pack "${name}" not found in registry (${url})`);
    }
    throw new Error(`Failed to fetch pack "${name}": HTTP ${res.status}`);
  }
  const manifest = await res.json();

  // Validate manifest shape
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Invalid pack manifest for "${name}": not a JSON object`);
  }
  if (!Array.isArray(manifest.snippets)) {
    throw new Error(`Invalid pack manifest for "${name}": missing "snippets" array`);
  }
  return manifest;
}

/**
 * Install a pack: fetch the manifest and add all snippets to storage.
 * Snippets are tagged with the pack name for discoverability.
 *
 * @param {string} name - Pack name
 * @returns {Promise<{name: string, version: string, description: string, imported: number}>}
 */
async function install(name) {
  const manifest = await fetchPack(name);
  let imported = 0;
  let skipped = 0;

  for (const entry of manifest.snippets) {
    // Skip entries missing required fields
    if (!entry.content) { skipped++; continue; }

    const safeName = String(entry.name || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeName || safeName.length === 0) { skipped++; continue; }

    // Skip if snippet with same name already exists
    const existing = storage.listSnippets().find(s => s.name === safeName);
    if (existing) {
      skipped++;
      continue;
    }

    // Tag with pack name plus any explicit tags from the entry
    const packTags = [name];
    if (Array.isArray(entry.tags)) {
      for (const t of entry.tags) {
        if (!packTags.includes(t)) packTags.push(t);
      }
    }

    try {
      storage.addSnippet({
        name: safeName,
        content: entry.content,
        language: entry.language || '',
        tags: packTags,
      });
      imported++;
    } catch (_) {
      skipped++;
    }
  }

  return {
    name: manifest.name || name,
    version: manifest.version || '1.0.0',
    description: manifest.description || '',
    imported,
    skipped,
    total: manifest.snippets.length,
  };
}

module.exports = { BUILTIN_PACKS, manifestUrl, fetchPack, install };
