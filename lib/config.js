const os = require('os');
const path = require('path');
const fs = require('fs');

// P1: Cache config in memory — one disk read per process lifetime
let _configCache = null;

const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const APP_DIR = path.join(XDG_DATA_HOME, 'snip');
const DB_FILE = path.join(APP_DIR, 'db.json');
const CONFIG_FILE = path.join(XDG_CONFIG_HOME, 'snip', 'config.json');

function ensureDirs() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
  const cfgDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
}

function getDefaults() {
  return {
    editor: process.env.EDITOR || 'vi',
    dataDir: APP_DIR,
    dbPath: DB_FILE,
    // sqlite options: set useSqlite true to enable SQLite storage and sqlitePath to set DB file
    useSqlite: false,
    sqlitePath: path.join(XDG_DATA_HOME, 'snip.db'),
    defaultShell: process.env.SHELL || 'sh',
    confirmRun: true
  };
}

function loadConfig() {
  if (_configCache) return _configCache;
  ensureDirs();
  const cfg = getDefaults();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Validate and sanitize user config
      const allowedKeys = ['editor', 'dataDir', 'dbPath', 'useSqlite', 'sqlitePath', 'defaultShell', 'confirmRun', 'gist_token'];
      for (const key of Object.keys(parsed)) {
        if (allowedKeys.includes(key)) {
          cfg[key] = parsed[key];
        }
      }
    }
  } catch (_e) {
    // ignore and return defaults
  }
  // Prefer env over config file so tokens are not stored on disk when possible
  if (process.env.SNIP_GIST_TOKEN) cfg.gist_token = process.env.SNIP_GIST_TOKEN;
  _configCache = cfg;
  return cfg;
}

function saveConfig(obj) {
  ensureDirs();
  const cfgDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
  // S5: Warn if writing sensitive keys to disk
  const sensitiveKeys = ['gist_token'];
  for (const key of sensitiveKeys) {
    if (obj[key] !== undefined) {
      console.warn(`Warning: storing "${key}" in config file. Consider using the SNIP_GIST_TOKEN env var instead.`);
    }
  }
  const cur = loadConfig();
  const merged = Object.assign(cur, obj);
  _configCache = merged; // keep cache in sync
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

module.exports = { ensureDirs, loadConfig, saveConfig, CONFIG_FILE, DB_FILE };
