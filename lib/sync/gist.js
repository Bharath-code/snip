const storage = require('../storage');
const config = require('../config');

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

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'snip-cli'
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
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: {
      'Authorization': token ? `token ${token}` : undefined,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'snip-cli'
    }
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
    const name = f.filename || fname;
    const content = f.content || '';
    const s = storage.addSnippet({ name, content, language: (name.split('.').pop() || '') });
    storage.setSnippetOrigin(s.id, { gistId });
    imported.push(s);
  }
  return imported;
}

module.exports = { pushSnippet, pullGist };