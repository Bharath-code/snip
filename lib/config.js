const os = require('os');
const path = require('path');
const fs = require('fs');

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
  ensureDirs();
  let cfg = getDefaults();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cfg = Object.assign(cfg, parsed);
    }
  } catch (e) {
    // ignore and return defaults
  }
  return cfg;
}

function saveConfig(obj) {
  ensureDirs();
  const cfgDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
  const cur = loadConfig();
  const merged = Object.assign(cur, obj);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

module.exports = { ensureDirs, loadConfig, saveConfig, CONFIG_FILE, DB_FILE };
