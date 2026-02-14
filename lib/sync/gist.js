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
  // record gist id in DB
  const db = storage.loadDB();
  if (db.snippets && db.snippets[snippet.id]) {
    db.snippets[snippet.id].origin = db.snippets[snippet.id].origin || {};
    db.snippets[snippet.id].origin.gistId = json.id;
    storage.saveDB(db);
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
    // record origin
    const db = storage.loadDB();
    db.snippets[s.id].origin = { gistId };
    storage.saveDB(db);
    imported.push(s);
  }
  return imported;
}

module.exports = { pushSnippet, pullGist };