/**
 * lib/diff.js — line-based diff engine for snippet versioning
 *
 * Uses a simple LCS (Longest Common Subsequence) algorithm
 * to compute line-level diffs between two strings.
 *
 * API:
 *   diffLines(textA, textB)        — Compute diff, return structured result
 *   formatDiff(result, options)    — Format diff as colored terminal output or JSON
 *   formatUnified(result)          — Format diff as unified-style text
 */

const { c } = require('./colors');

/**
 * Compute a line-level diff between two strings.
 * Uses a standard LCS-based Myers-like diff approach.
 *
 * @param {string} textA - Original text
 * @param {string} textB - New text
 * @returns {{ added: number, removed: number, unchanged: number, hunks: Array<{type: string, lines: string[]}> }}
 */
function diffLines(textA, textB) {
  const linesA = (textA || '').split('\n');
  const linesB = (textB || '').split('\n');

  // Build LCS table
  const m = linesA.length;
  const n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  const hunks = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  function addHunk(type, line) {
    const last = hunks[hunks.length - 1];
    if (last && last.type === type) {
      last.lines.push(line);
    } else {
      hunks.push({ type, lines: [line] });
    }
    if (type === 'add') added++;
    else if (type === 'remove') removed++;
    else if (type === 'same') unchanged++;
  }

  let i = m, j = n;
  const stack = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'same', line: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', line: linesB[j - 1] });
      j--;
    } else if (i > 0) {
      stack.push({ type: 'remove', line: linesA[i - 1] });
      i--;
    }
  }

  // Reverse stack to get correct order
  while (stack.length > 0) {
    const item = stack.pop();
    addHunk(item.type, item.line);
  }

  return {
    added,
    removed,
    unchanged,
    hunks,
  };
}

/**
 * Format a diff result for terminal display with colors.
 * @param {object} result - Result from diffLines()
 * @param {object} options
 * @param {string} options.labelA - Label for the left side (default: "original")
 * @param {string} options.labelB - Label for the right side (default: "modified")
 * @param {number} options.contextLines - Lines of context around changes (default: 3)
 * @returns {string} Colored terminal output
 */
function formatDiff(result, options = {}) {
  const { labelA = 'original', labelB = 'modified', contextLines = 3 } = options;

  if (result.added === 0 && result.removed === 0) {
    return c.dim('  (no differences)');
  }

  const lines = [];

  // Summary
  lines.push(c.dim(`  ${result.unchanged} unchanged  `) +
    c.success(`+${result.added} added  `) +
    c.err(`-${result.removed} removed`));

  // Build compact view with context
  const ctxQueue = [];
  let pendingCtx = 0;
  let inChange = false;

  for (const hunk of result.hunks) {
    if (hunk.type === 'same') {
      if (inChange) {
        pendingCtx = 0;
        ctxQueue.length = 0;
        inChange = false;
      }
      if (ctxQueue.length < contextLines) {
        ctxQueue.push(hunk.lines[0]);
      } else {
        // Shift queue
        ctxQueue.shift();
        ctxQueue.push(hunk.lines[0]);
      }
      continue;
    }

    // We hit a change — flush context lines before it
    if (ctxQueue.length > 0) {
      const ctxToShow = ctxQueue.slice(-contextLines);
      for (const ctxLine of ctxToShow) {
        lines.push(c.dim(`  ${ctxLine}`));
      }
      ctxQueue.length = 0;
    }

    inChange = true;

    if (hunk.type === 'remove') {
      for (const line of hunk.lines) {
        lines.push(c.err(`- ${line}`));
      }
    } else if (hunk.type === 'add') {
      for (const line of hunk.lines) {
        lines.push(c.success(`+ ${line}`));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format diff as a JSON-compatible structure.
 * @param {object} result - Result from diffLines()
 * @returns {object} JSON-serializable diff
 */
function formatDiffJSON(result) {
  return {
    stats: {
      added: result.added,
      removed: result.removed,
      unchanged: result.unchanged,
    },
    changes: result.hunks.map(h => ({
      type: h.type,
      lines: h.lines,
    })),
  };
}

/**
 * Format diff in unified format (like `diff -u`).
 * @param {object} result - Result from diffLines()
 * @param {object} options
 * @returns {string}
 */
function formatUnified(result) {
  if (result.added === 0 && result.removed === 0) return '';

  const lines = [];
  let lineNum = 1;

  for (const hunk of result.hunks) {
    for (const line of hunk.lines) {
      if (hunk.type === 'same') {
        lines.push(` ${line}`);
      } else if (hunk.type === 'remove') {
        lines.push(`-${line}`);
      } else if (hunk.type === 'add') {
        lines.push(`+${line}`);
      }
    }
  }

  return lines.join('\n');
}

module.exports = {
  diffLines,
  formatDiff,
  formatDiffJSON,
  formatUnified,
};
