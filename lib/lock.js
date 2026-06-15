/**
 * File-based lock for JSON backend to prevent concurrent read-modify-write corruption.
 * Uses exclusive create (O_CREAT|O_EXCL) — one writer at a time.
 *
 * Sleeps between retries using Atomics.wait (OS-suspended, not CPU-burning spinlock).
 * Includes stale lock detection: if the lock holder's PID is no longer alive and
 * the lock is older than STALE_MS, the lock is removed and retried.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RETRIES = 20;
const RETRY_MS = 50;
const STALE_MS = 2000; // 2 seconds — consider lock stale if older

// SharedArrayBuffer + Atomics.wait for efficient synchronous sleep.
// Atomics.wait blocks the thread via the OS scheduler — no CPU burn.
const _sleepSAB = new Int32Array(new SharedArrayBuffer(4));

function _sleep(ms) {
  Atomics.wait(_sleepSAB, 0, 0, ms);
}

/**
 * Check if a lock is stale — the creating process is no longer alive.
 * On platforms that support it (Linux/macOS), we send signal 0 to the PID
 * to check existence without actually sending a signal.
 */
function _isPidAlive(pid) {
  try {
    return process.kill(pid, 0);
  } catch (e) {
    // ESRCH = no such process (dead), EPERM = alive but can't signal
    return e.code === 'EPERM';
  }
}

/**
 * Try to read and parse the lock file. Returns null on failure.
 */
function _readLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Write a structured lock file with PID, hostname, and timestamp.
 */
function _writeLock(lockPath) {
  const lockData = JSON.stringify({
    pid: process.pid,
    hostname: os.hostname(),
    time: Date.now(),
  });
  fs.writeFileSync(lockPath, lockData, { flag: 'wx' });
}

/**
 * Acquire a file-based lock, execute fn, then release.
 *
 * @param {string} lockPath - Path to the lock file (e.g., dbPath + '.lock')
 * @param {Function} fn - Function to execute while holding the lock
 * @returns {*} The return value of fn
 * @throws {Error} If lock cannot be acquired after all retries
 */
function withLock(lockPath, fn) {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let acquired = false;

  for (let i = 0; i < RETRIES; i++) {
    try {
      _writeLock(lockPath);
      acquired = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;

      // Check for stale lock — if the creating process is dead and the lock
      // is old enough, remove it and retry immediately.
      if (i < RETRIES - 1) {
        const lockInfo = _readLock(lockPath);
        if (lockInfo && lockInfo.pid && lockInfo.pid !== process.pid) {
          const lockAge = Date.now() - (lockInfo.time || 0);
          if (lockAge > STALE_MS && !_isPidAlive(lockInfo.pid)) {
            // Stale lock — remove and retry without waiting
            try { fs.unlinkSync(lockPath); } catch (_) { /* race, next iteration handles it */ }
            continue;
          }
        }
        _sleep(RETRY_MS);
      } else {
        // Last retry failed — give up with detailed error
        const lockInfo = _readLock(lockPath);
        let detail = '';
        if (lockInfo) {
          const age = ((Date.now() - (lockInfo.time || 0)) / 1000).toFixed(1);
          detail = ` (locked by PID ${lockInfo.pid} on ${lockInfo.hostname}, ${age}s ago)`;
        }
        throw new Error(
          `Could not acquire DB lock${detail}. ` +
          'Another snip process may be running. ' +
          `If stuck, remove: ${lockPath}`
        );
      }
    }
  }

  try {
    return fn();
  } finally {
    if (acquired) {
      try { fs.unlinkSync(lockPath); } catch (_) { /* best-effort cleanup */ }
    }
  }
}

module.exports = { withLock };
