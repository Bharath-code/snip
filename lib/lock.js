/**
 * Simple file-based lock for JSON backend to prevent concurrent read-modify-write corruption.
 * Uses exclusive create (O_CREAT|O_EXCL) — one writer at a time.
 */
const fs = require('fs');
const path = require('path');

const RETRIES = 20;
const RETRY_MS = 50;

function withLock(lockPath, fn) {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let acquired = false;
  for (let i = 0; i < RETRIES; i++) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      acquired = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (i < RETRIES - 1) {
        const deadline = Date.now() + RETRY_MS;
        while (Date.now() < deadline) {}
      } else {
        throw new Error('Could not acquire DB lock (another snip process may be running). Try again.');
      }
    }
  }
  try {
    return fn();
  } finally {
    if (acquired) {
      try { fs.unlinkSync(lockPath); } catch (_) {}
    }
  }
}

module.exports = { withLock };
