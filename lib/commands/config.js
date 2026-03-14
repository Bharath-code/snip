const cfg = require('../config');

const ALLOWED_KEYS = ['editor', 'dataDir', 'dbPath', 'useSqlite', 'sqlitePath', 'defaultShell', 'confirmRun', 'gist_token', 'sortMode'];
const BOOLEAN_KEYS = ['useSqlite', 'confirmRun'];

function run(action, key, value) {
  if (action === 'get') {
    const c = cfg.loadConfig();
    if (!key) return console.log(JSON.stringify(c, null, 2));
    return console.log((c && c[key]) || '');
  }
  if (action === 'set') {
    if (!key) {
      console.error('Key required for set');
      process.exitCode = 1;
      return;
    }
    if (!ALLOWED_KEYS.includes(key)) {
      console.error(`Unknown key "${key}". Allowed: ${ALLOWED_KEYS.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    let parsed = value;
    if (BOOLEAN_KEYS.includes(key)) {
      parsed = value === 'true' || value === '1' || value === 'yes';
      if (value !== undefined && value !== '' && value !== 'false' && value !== '0' && value !== 'no' && !parsed) {
        console.error(`Value for ${key} should be true/false`);
        process.exitCode = 1;
        return;
      }
    }
    const obj = {};
    obj[key] = parsed;
    cfg.saveConfig(obj);
    return console.log('OK');
  }
  console.error('Unknown action; use get/set');
  process.exitCode = 1;
}

module.exports = run;
