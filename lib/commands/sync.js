const gist = require('../sync/gist');
const cfg = require('../config');
const storage = require('../storage');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');

async function run(action, id) {
  const config = cfg.loadConfig();
  const token = config.gist_token;
  try {
    if (action === 'push') {
      if (!id) {
        console.error(c.err('  ✗ Usage: snip sync push <snippetId|name>'));
        setExitCode(2);
        return;
      }
      if (!token) {
        console.error(c.err('  ✗ No gist token found. Set SNIP_GIST_TOKEN or: snip config set gist_token <token>'));
        setExitCode(1);
        return;
      }
      const res = await gist.pushSnippet(id, token);
      log('Pushed to gist:', res.html_url || res.id);
      return;
    }
    if (action === 'pull') {
      if (!id) {
        console.error(c.err('  ✗ Usage: snip sync pull <gistId>'));
        setExitCode(2);
        return;
      }
      const existing = storage.listSnippets().filter(s => s.origin && s.origin.gistId === id);
      if (existing.length) {
        console.warn(`You already have ${existing.length} snippet(s) from this gist. Pulling will add new copies.`);
      }
      const imported = await gist.pullGist(id, token);
      log('Imported', imported.length, 'files from gist', id);
      return;
    }
    console.error(c.err('  ✗ Unknown action. Use push|pull'));
    setExitCode(2);
  } catch (e) {
    console.error(c.err('  ✗ Sync failed:'), e.message);
    setExitCode(1);
  }
}

module.exports = run;
