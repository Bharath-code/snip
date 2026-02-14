const gist = require('../sync/gist');
const cfg = require('../config');

async function run(action, id) {
  const config = cfg.loadConfig();
  const token = config.gist_token;
  try {
    if (action === 'push') {
      if (!id) return console.error('Usage: snip sync push <snippetId|name>');
      if (!token) return console.error('No gist token found. Set SNIP_GIST_TOKEN env var or: snip config set gist_token <token>');
      const res = await gist.pushSnippet(id, token);
      console.log('Pushed to gist:', res.html_url || res.id);
      return;
    }
    if (action === 'pull') {
      if (!id) return console.error('Usage: snip sync pull <gistId>');
      const imported = await gist.pullGist(id, token);
      console.log('Imported', imported.length, 'files from gist', id);
      return;
    }
    console.error('Unknown action. Use push|pull');
  } catch (e) {
    console.error('Sync failed:', e.message);
  }
}

module.exports = run;