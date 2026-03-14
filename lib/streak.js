/**
 * Lightweight streak tracking: days in a row using snip (run/exec/last).
 * Stores { lastDate: "YYYY-MM-DD", streak: number } in dataDir/.streak
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function streakPath() {
  const cfg = config.loadConfig();
  const dir = cfg.dataDir || path.join(require('os').homedir(), '.local', 'share', 'snip');
  return path.join(dir, '.streak');
}

function recordUsage() {
  try {
    const fp = streakPath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const now = today();
    const prev = yesterday();
    let data = { lastDate: null, streak: 0 };
    if (fs.existsSync(fp)) {
      try {
        data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      } catch (_) {}
    }
    if (data.lastDate === now) return data.streak;
    if (data.lastDate === prev) {
      data.streak = (data.streak || 0) + 1;
    } else {
      data.streak = 1;
    }
    data.lastDate = now;
    fs.writeFileSync(fp, JSON.stringify(data), 'utf8');
    return data.streak;
  } catch (_) {
    return 0;
  }
}

function getStreak() {
  try {
    const fp = streakPath();
    if (!fs.existsSync(fp)) return { streak: 0, lastDate: null };
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const now = today();
    if (data.lastDate !== now) return { streak: 0, lastDate: data.lastDate };
    return { streak: data.streak || 0, lastDate: data.lastDate };
  } catch (_) {
    return { streak: 0, lastDate: null };
  }
}

module.exports = { recordUsage, getStreak };
