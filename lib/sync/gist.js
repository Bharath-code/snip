const storage = require('../storage');
const config = require('../config');

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

async function pushSnippet(snippetId, token) {
  const snippet = storage.getSnippetByIdOrName(snippetId);
  if (!snippet) throw new Error('Snippet not found');
  const content = storage.readSnippetContent(snippet);
  const body = {
    description: `snip: ${snippet.name}`,
    public: false,
    files: {}
  };
  const filename = snippet.name.replace(/[^a-z0-9_.-]/gi, '_') + (snippet.language ? '.' + snippet.language : '.txt');
  body.files[filename] = { content };

  const res = await githubFetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist push failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  const existing = storage.getSnippetByIdOrName(snippet.id);
  if (existing) {
    const origin = (existing.origin && typeof existing.origin === 'object') ? { ...existing.origin } : {};
    origin.gistId = json.id;
    storage.setSnippetOrigin(snippet.id, origin);
  }
  return json;
}

async function pullGist(gistId, token) {
  const res = await githubFetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: token ? { 'Authorization': `token ${token}` } : {}
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist fetch failed: ${res.status} ${text}`);
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

module.exports = { pushSnippet, pullGist };