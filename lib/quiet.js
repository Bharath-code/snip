/**
 * Quiet-mode helpers for snip.
 * When SNIP_QUIET is set, decorative output is suppressed.
 * Error messages and essential data output always pass through.
 */

function isQuiet() {
  return !!(process.env.SNIP_QUIET);
}

/**
 * Like console.log, but suppresses output when quiet mode is active.
 * Use for decorative/non-essential output (borders, success messages, hints).
 * Do NOT use for data output (JSON, list results, snippet content).
 */
function log(...args) {
  if (!isQuiet()) {
    console.log(...args);
  }
}

/**
 * Like console.error — always passes through regardless of quiet mode.
 */
function error(...args) {
  console.error(...args);
}

module.exports = { isQuiet, log, error };
