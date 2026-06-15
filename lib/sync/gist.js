const storage = require('../storage');

// Simple rate limiter for GitHub API
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 50; // Max requests per window
const requestTimestamps = [];

function checkRateLimit() {
  const now = Date.now();
  // Evict timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    const oldest = requestTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW - (now - oldest);
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }
  requestTimestamps.push(now);
}

async function githubFetch(url, options = {}) {
  checkRateLimit();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'snip-cli',
      ...options.headers
    }
  });

  // Check for rate limit response
  const remaining = res.headers.get('X-RateLimit-Remaining');
  const reset = res.headers.get('X-RateLimit-Reset');

  if (remaining === '0') {
    const resetTime = reset ? new Date(reset * 1000).toLocaleTimeString() : 'unknown';
    console.warn(`GitHub API rate limit reached. Resets at ${resetTime}`);
  }

  return res;
}

/**
 * Build a gist files object from a snippet
 */
function snippetToFile(snippet) {
  const content = storage.readSnippetContent(snippet);
  const filename = snippet.name.replace(/[^a-z0-9_.-]/gi, '_') + (snippet.language ? '.' + snippet.language : '.txt');
  return { filename, content };
}

/**
 * Create a gist on GitHub
 */
async function createGist({ description, files, token, isPublic = false }) {
  const body = {
    description,
    public: isPublic,
    files: {}
  };
  for (const f of files) {
    body.files[f.filename] = { content: f.content };
  }

  const res = await githubFetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT (Personal Access Token).');
    const text = await res.text();
    throw new Error(`Gist push failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Mark a snippet's origin with a gist ID */
function markGistOrigin(snippetId, gistId) {
  const existing = storage.getSnippetByIdOrName(snippetId);
  if (existing) {
    const origin = (existing.origin && typeof existing.origin === 'object') ? { ...existing.origin } : {};
    origin.gistId = gistId;
    storage.setSnippetOrigin(snippetId, origin);
  }
}

async function pushSnippet(snippetId, token) {
  const snippet = storage.getSnippetByIdOrName(snippetId);
  if (!snippet) throw new Error('Snippet not found');

  const { filename, content } = snippetToFile(snippet);
  const json = await createGist({
    description: `snip: ${snippet.name}`,
    files: [{ filename, content }],
    token,
    isPublic: false
  });

  markGistOrigin(snippet.id, json.id);
  return json;
}

async function shareSnippet(snippetId, token) {
  const snippet = storage.getSnippetByIdOrName(snippetId);
  if (!snippet) throw new Error('Snippet not found');

  const { filename, content } = snippetToFile(snippet);
  const json = await createGist({
    description: `snip: ${snippet.name}`,
    files: [{ filename, content }],
    token,
    isPublic: true
  });

  markGistOrigin(snippet.id, json.id);
  return json;
}

async function sharePack(snippetIds, token) {
  const files = [];
  const names = [];
  for (const id of snippetIds) {
    const snippet = storage.getSnippetByIdOrName(id);
    if (!snippet) throw new Error(`Snippet not found: "${id}"`);
    const { filename, content } = snippetToFile(snippet);
    files.push({ filename, content });
    names.push(snippet.name);
  }

  const json = await createGist({
    description: `snip pack: ${names.join(', ')}`,
    files,
    token,
    isPublic: true
  });

  for (const snippet of names.map(n => storage.getSnippetByIdOrName(n)).filter(Boolean)) {
    markGistOrigin(snippet.id, json.id);
  }
  return json;
}

async function deleteGist(gistId, token) {
  const res = await githubFetch(`https://api.github.com/gists/${gistId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`
    }
  });
  if (res.status === 404) {
    throw new Error(`Gist not found: ${gistId}`);
  }
  if (res.status === 401) {
    throw new Error('Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT (Personal Access Token).');
  }
  if (res.status === 403) {
    throw new Error('Cannot delete this gist. It may belong to another user.');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist delete failed: ${res.status} ${text}`);
  }
  return true;
}

async function pullGist(gistId, token) {
  const res = await githubFetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: token ? { 'Authorization': `token ${token}` } : {}
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT (Personal Access Token).');
    const text = await res.text();
    throw new Error(`Gist fetch failed: ${res.status} ${text}`);
  }

  // S-GIST-1: Guard against oversized responses (max 5MB)
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > 5 * 1024 * 1024) {
    throw new Error(`Gist response too large (${(contentLength / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
  }
  const json = await res.json();
  // import files as snippets
  const files = json.files || {};
  const imported = [];
  for (const fname of Object.keys(files)) {
    const f = files[fname];
    // Sanitize filename to prevent path traversal
    const rawName = f.filename || fname;
    const safeName = rawName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.\./g, '_');
    const name = safeName || 'unnamed';
    const content = f.content || '';
    const s = storage.addSnippet({ name, content, language: (name.split('.').pop() || '') });
    storage.setSnippetOrigin(s.id, { gistId });
    imported.push(s);
  }
  return imported;
}

/**
 * Search code in public gists via GitHub Code Search API.
 * Uses `is:gist` qualifier to scope results to gists only.
 * Requires authentication (token) — GitHub Search API requires it.
 */
async function searchCodeGists(query, token, opts = {}) {
  const lang = opts.lang || '';
  let q = query;
  if (lang) q += `+language:${lang}`;
  q += '+is:gist';

  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=${Math.min(opts.limit || 15, 100)}&page=${opts.page || 1}`;
  const res = await githubFetch(url, {
    method: 'GET',
    headers: token ? { 'Authorization': `token ${token}` } : {}
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT.');
    if (res.status === 403) {
      const text = await res.text();
      if (text.includes('rate limit')) throw new Error('GitHub API rate limit exceeded. Try again later or use a token.');
      throw new Error(`Search failed: ${res.status} — authentication required for code search`);
    }
    const text = await res.text();
    throw new Error(`Search failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * List recent public gists from GitHub.
 * Works without auth (but lower rate limits).
 */
async function listRecentGists(token, opts = {}) {
  const url = `https://api.github.com/gists/public?per_page=${Math.min(opts.limit || 30, 100)}&page=${opts.page || 1}`;
  const res = await githubFetch(url, {
    method: 'GET',
    headers: token ? { 'Authorization': `token ${token}` } : {}
  });
  if (!res.ok) {
    if (res.status === 403) {
      const text = await res.text();
      if (text.includes('rate limit')) throw new Error('GitHub API rate limit exceeded. Try again later or use a token.');
      throw new Error(`Listing gists failed: ${res.status}`);
    }
    const text = await res.text();
    throw new Error(`Listing gists failed: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = { pushSnippet, pullGist, shareSnippet, sharePack, deleteGist, createGist, snippetToFile, searchCodeGists, listRecentGists };