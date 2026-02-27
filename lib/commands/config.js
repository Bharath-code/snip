const cfg = require('../config');

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
    const obj = {};
    obj[key] = value;
    cfg.saveConfig(obj);
    return console.log('OK');
  }
  console.error('Unknown action; use get/set');
  process.exitCode = 1;
}

module.exports = run;
