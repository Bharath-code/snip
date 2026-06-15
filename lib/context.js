/**
 * Context detection for snip — examines the current directory to determine
 * what kind of project you're in and surface relevant snippets.
 *
 * Looks for signals like Dockerfile, package.json, Makefile, Terraform files,
 * git remotes, and directory names to infer project type and topic tags.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ── Detection rules ────────────────────────────────────────────────

/**
 * Map from filename patterns to context tags.
 * Each entry: { pattern: string/RegExp, tags: string[], priority: number }
 */
// CI / infra directory signals — matched against directory names for deeper project detection
// isDir signals use regex patterns to detect project type from subdirectory names
const DIR_SIGNALS = [
  { pattern: /^(docker|dockerfiles?)/i, tags: ['docker'], priority: 75 },
  { pattern: /^(k8s|kubernetes)/i, tags: ['k8s', 'kubernetes'], priority: 75 },
  { pattern: /^(helm|charts)/i, tags: ['helm', 'k8s'], priority: 75 },
  { pattern: /^(terraform|tf)/i, tags: ['terraform'], priority: 75 },
  { pattern: /^(ci|cd|\.github)/i, tags: ['ci'], priority: 70 },
  { pattern: /^(scripts?|bin)/i, tags: ['script'], priority: 60 },
];

// Directory name → context tag mapping for deeper project detection
const DIR_NAME_SIGNALS = [
  { pattern: /^docker/i, tags: ['docker'] },
  { pattern: /^(k8s|kubernetes)/i, tags: ['k8s', 'kubernetes'] },
  { pattern: /^terraform/i, tags: ['terraform'] },
  { pattern: /^(node|npm|yarn)/i, tags: ['node', 'npm'] },
  { pattern: /^(python|py)/i, tags: ['python'] },
  { pattern: /^(rust|cargo)/i, tags: ['rust', 'cargo'] },
  { pattern: /^(go|golang)/i, tags: ['go', 'golang'] },
  { pattern: /^(ruby|gem)/i, tags: ['ruby'] },
  { pattern: /^php/i, tags: ['php'] },
  { pattern: /^java/i, tags: ['java'] },
  { pattern: /^helm/i, tags: ['helm', 'k8s'] },
  { pattern: /^(ci|cd)/i, tags: ['ci'] },
  { pattern: /^(env|config)/i, tags: ['env', 'config'] },
  { pattern: /^(nix)/i, tags: ['nix'] },
];

// Content keyword signatures: snippets whose content contains these keywords
// get a relevance bump when the matching context tag is present.
const CONTENT_KEYWORDS = {
  node: ['require(', 'import ', 'module.exports', 'npm ', 'npx ', 'node '],
  npm: ['npm ', 'npx ', 'package.json', 'node_modules'],
  docker: ['docker ', 'docker-compose', 'container', 'image', 'Dockerfile'],
  python: ['import ', 'def ', 'print(', 'pip ', 'python', 'venv', 'django', 'flask'],
  ruby: ['gem ', 'bundle ', 'def ', 'end', 'rails', 'rake '],
  go: ['func ', 'package ', 'import (', 'golang'],
  rust: ['fn ', 'let mut', 'cargo ', 'impl '],
  terraform: ['resource ', 'provider ', 'terraform', 'variable ', 'output '],
  k8s: ['kubectl ', 'apiVersion', 'kind: ', 'deployment', 'service '],
  kubernetes: ['kubectl ', 'apiVersion', 'kind: ', 'deployment', 'service '],
  git: ['git ', 'git commit', 'git push', 'git pull', 'git clone'],
  ci: ['github.workspace', 'CI=', 'GITHUB_', 'gitlab'],
  'github-actions': ['github.workspace', 'CI=', 'GITHUB_'],
  make: ['make ', '$(MAKE)', 'Makefile'],
  php: ['<?php', 'function ', 'composer ', 'artisan'],
  java: ['public class', 'import ', 'gradle', 'maven', 'System.out'],
  typescript: [': string', ': number', ': void', 'interface ', 'type ', 'as const'],
  ts: [': string', ': number', ': void', 'interface ', 'type ', 'as const'],
};

const FILE_SIGNALS = [
  // Build / config files
  { pattern: 'package.json', tags: ['node', 'npm'], priority: 90 },
  { pattern: 'yarn.lock', tags: ['node', 'yarn'], priority: 85 },
  { pattern: 'pnpm-lock.yaml', tags: ['node', 'pnpm'], priority: 85 },
  { pattern: 'tsconfig.json', tags: ['typescript', 'ts'], priority: 80 },
  { pattern: 'Dockerfile', tags: ['docker'], priority: 90 },
  { pattern: 'docker-compose.yml', tags: ['docker'], priority: 85 },
  { pattern: 'docker-compose.yaml', tags: ['docker'], priority: 85 },
  { pattern: 'Makefile', tags: ['make'], priority: 80 },
  { pattern: 'Cargo.toml', tags: ['rust', 'cargo'], priority: 90 },
  { pattern: 'go.mod', tags: ['go', 'golang'], priority: 90 },
  { pattern: 'Gemfile', tags: ['ruby'], priority: 85 },
  { pattern: 'Gemfile.lock', tags: ['ruby'], priority: 80 },
  { pattern: 'requirements.txt', tags: ['python'], priority: 80 },
  { pattern: 'setup.py', tags: ['python'], priority: 80 },
  { pattern: 'pyproject.toml', tags: ['python'], priority: 85 },
  { pattern: 'Pipfile', tags: ['python'], priority: 75 },
  { pattern: 'composer.json', tags: ['php'], priority: 80 },
  { pattern: 'build.gradle', tags: ['java', 'gradle'], priority: 80 },
  { pattern: 'pom.xml', tags: ['java', 'maven'], priority: 80 },
  { pattern: '*.tf', tags: ['terraform'], priority: 80 },
  { pattern: '*.tfvars', tags: ['terraform'], priority: 75 },
  { pattern: '*.k8s.yaml', tags: ['k8s', 'kubernetes'], priority: 75 },
  { pattern: '*.k8s.yml', tags: ['k8s', 'kubernetes'], priority: 75 },
  { pattern: 'Chart.yaml', tags: ['helm', 'k8s'], priority: 80 },
  { pattern: '.gitlab-ci.yml', tags: ['ci', 'gitlab'], priority: 70 },
  { pattern: '.github/workflows/*.yml', tags: ['ci', 'github-actions'], priority: 70 },
  { pattern: '.env.example', tags: ['env', 'config'], priority: 60 },
  { pattern: 'vagrantfile', tags: ['vagrant'], priority: 70 },
  { pattern: /Dockerfile\.[a-zA-Z]+$/, tags: ['docker'], priority: 85 },
  { pattern: /\.nix$/, tags: ['nix'], priority: 75 },
];

// ── Git helpers ────────────────────────────────────────────────────

function getGitRemote() {
  try {
    const res = spawnSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.status === 0 && res.stdout) {
      const url = res.stdout.trim();
      // Extract org/repo from common git URL formats
      const m = url.match(/([^/:]+)\/([^/]+?)(?:\.git)?$/);
      if (m) return { org: m[1], repo: m[2].replace(/\.git$/, ''), url };
      return { url };
    }
  } catch (_) { /* git not available or not a git repo */ }
  return null;
}

function getGitBranch() {
  try {
    const res = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch (_) { /* */ }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Detect project context from the current working directory.
 *
 * @param {string} [dir] - Directory to inspect (defaults to process.cwd())
 * @returns {object} Context info:
 *   - projectType: detected primary project type (e.g. 'node', 'docker', 'python')
 *   - projectName: directory name or git repo name
 *   - tags: array of context tags (e.g. ['docker', 'node', 'npm'])
 *   - files: matched files found
 *   - signals: matched signal objects with priority
 *   - gitRemote: { org, repo, url } or null
 *   - branch: current git branch or null
 */
function detectContext(dir) {
  const targetDir = dir || process.cwd();

  // ── Detect project name ──
  const dirName = path.basename(targetDir);

  // Try git remote first
  const gitRemote = getGitRemote();
  const branch = getGitBranch();
  const projectName = (gitRemote && gitRemote.repo) || dirName;

  // ── Scan for signal files and subdirectories ──
  let entries;
  try {
    entries = fs.readdirSync(targetDir, { withFileTypes: true });
  } catch (_) {
    // Directory doesn't exist or can't be read
    return {
      projectType: 'unknown',
      projectName: dirName,
      tags: [],
      files: [],
      signals: [],
      gitRemote: null,
      branch: null,
    };
  }

  const fileNames = entries.map(e => e.name);
  const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
  const matchedSignals = [];

  // Match file signals against file names
  for (const signal of FILE_SIGNALS) {
    if (typeof signal.pattern === 'string') {
      // Exact filename match
      if (fileNames.includes(signal.pattern)) {
        matchedSignals.push({ ...signal, matchedFile: signal.pattern });
      }
      // Glob-like wildcard pattern (e.g. *.tf)
      if (signal.pattern.includes('*')) {
        const regex = new RegExp('^' + signal.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        for (const f of fileNames) {
          if (regex.test(f)) {
            matchedSignals.push({ ...signal, matchedFile: f });
            break;
          }
        }
      }
    } else if (signal.pattern instanceof RegExp) {
      // Regex file name match
      for (const f of fileNames) {
        if (signal.pattern.test(f)) {
          matchedSignals.push({ ...signal, matchedFile: f });
          break;
        }
      }
    }
  }

  // Match directory signals against directory names (e.g., docker/, k8s/, ci/)
  for (const signal of DIR_SIGNALS) {
    for (const d of dirNames) {
      if (signal.pattern.test(d)) {
        matchedSignals.push({ ...signal, isDir: true, matchedFile: d + '/' });
        break;
      }
    }
  }

  // ── Directory name as fallback signal ──
  // If we're in a subdirectory like 'docker/', 'scripts/', etc., use its name
  if (matchedSignals.length === 0) {
    for (const ds of DIR_NAME_SIGNALS) {
      if (ds.pattern.test(dirName)) {
        matchedSignals.push({ pattern: dirName, tags: ds.tags, priority: 65, matchedFile: dirName + '/' });
        break;
      }
    }
  }

  // Deduplicate tags by priority (highest priority wins)
  const tagPriority = {};
  const tags = [];
  const files = [];
  const signals = [];

  // Sort by priority descending
  matchedSignals.sort((a, b) => b.priority - a.priority);

  for (const signal of matchedSignals) {
    signals.push(signal);
    files.push(signal.matchedFile);
    for (const tag of signal.tags) {
      if (!tagPriority[tag]) {
        tagPriority[tag] = signal.priority;
        tags.push(tag);
      }
    }
  }

  // Determine primary project type (highest-priority tag)
  const projectType = tags.length > 0 ? tags[0] : 'unknown';

  return {
    projectType,
    projectName,
    tags,
    files,
    signals,
    gitRemote,
    branch,
  };
}

/**
 * Score a snippet's relevance to the current context.
 * Returns a score 0-100.
 */
function scoreRelevance(snippet, context) {
  let score = 0;

  // Direct tag match (each matching tag = +25)
  const snippetTags = (snippet.tags || []).map(t => t.toLowerCase());
  for (const ctxTag of context.tags) {
    if (snippetTags.includes(ctxTag)) {
      score += 25;
    }
    // Partial tag match: e.g. snippet tag "node-env" matches context tag "node"
    if (snippetTags.some(t => t.includes(ctxTag) || ctxTag.includes(t))) {
      if (!snippetTags.includes(ctxTag)) {
        score += 15;
      }
    }
  }

  // Language match (+20)
  const lang = (snippet.language || '').toLowerCase();
  if (lang && context.tags.some(t => t === lang || t.includes(lang) || lang.includes(t))) {
    score += 20;
  }

  // Name match (+10)
  const name = (snippet.name || '').toLowerCase();
  const projName = context.projectName.toLowerCase();
  for (const ctxTag of context.tags) {
    if (name.includes(ctxTag)) score += 10;
  }
  if (name.includes(projName)) score += 10;

  // Content-based match (+15 per matching keyword group, capped at +45)
  // Checks if snippet content contains keywords relevant to the context
  let contentScore = 0;
  for (const ctxTag of context.tags) {
    const keywords = CONTENT_KEYWORDS[ctxTag];
    if (keywords && snippet.content) {
      const lowerContent = snippet.content.toLowerCase();
      for (const kw of keywords) {
        if (lowerContent.includes(kw)) {
          contentScore += 15;
          break; // One match per tag
        }
      }
    }
  }
  score += Math.min(contentScore, 45);

  // Usage bonus (+5 per use, capped at +20)
  const usage = snippet.usageCount || 0;
  score += Math.min(usage * 5, 20);

  // Recency bonus (used within last 7 days = +10)
  if (snippet.lastUsedAt) {
    const daysAgo = (Date.now() - new Date(snippet.lastUsedAt).getTime()) / 86400000;
    if (daysAgo < 7) score += 10;
  }

  return Math.min(score, 100);
}

module.exports = { detectContext, scoreRelevance, FILE_SIGNALS, DIR_SIGNALS, DIR_NAME_SIGNALS, CONTENT_KEYWORDS };
