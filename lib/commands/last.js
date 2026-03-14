/**
 * snip last — re-run the last executed snippet (like !! for your library).
 */
const path = require('path');
const fs = require('fs');
const config = require('../config');
const storage = require('../storage');
const execCmd = require('./exec');

function lastRunFile() {
  const cfg = config.loadConfig();
  return path.join(cfg.dataDir || path.join(require('os').homedir(), '.local', 'share', 'snip'), '.last-run');
}

function getLastId() {
  try {
    const f = lastRunFile();
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  } catch (_) {}
  return null;
}

function setLastRun(idOrName) {
  try {
    const cfg = config.loadConfig();
    const dir = cfg.dataDir || path.join(require('os').homedir(), '.local', 'share', 'snip');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.last-run'), String(idOrName), 'utf8');
  } catch (_) {}
}

async function lastCmd() {
  const id = getLastId();
  if (!id) {
    console.error('No snippet has been run yet. Run one with: snip run <name> or snip exec <name>');
    process.exitCode = 1;
    return;
  }
  return execCmd(id, {});
}

module.exports = lastCmd;
module.exports.getLastId = getLastId;
module.exports.setLastRun = setLastRun;
module.exports.lastRunFile = lastRunFile;
