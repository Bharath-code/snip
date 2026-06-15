/**
 * snip watch-history — background watcher that detects repeated commands
 * and offers to save them as snippets.
 *
 * Polls shell history every N seconds, finds commands run 3+ times
 * in recent history that aren't already saved or suggested, and
 * interactively prompts the user to save them.
 *
 * Usage:
 *   snip watch-history                      # Default poll interval 60s
 *   snip watch-history --interval 30        # Poll every 30 seconds
 *   snip watch-history --last 200           # Check last 200 history lines
 *   snip watch-history --min-count 5        # Only suggest commands run 5+ times
 *   snip watch-history --auto               # Auto-save without prompting
 *   snip watch-history --once               # Run once (non-watching mode)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { question } = require('../readline');
const { setExitCode } = require('../cli-utils');
const { stripAnsi } = require('../format');
const {
  getHistoryPath,
  generateName,
  detectLanguage,
  filterExisting,
  parseHistoryFile,
  countCommandFrequency,
} = require('../history');

const DEFAULT_INTERVAL = 60; // seconds between polls
const DEFAULT_LAST = 100;
const MIN_COUNT = 3;

// ── State file for tracking already-suggested commands ──

function stateFilePath() {
  const cfg = require('../config').loadConfig();
  const dir = cfg.dataDir || path.join(os.homedir(), '.local', 'share', 'snip');
  return path.join(dir, 'watch-history-state.json');
}

function loadState() {
  try {
    const f = stateFilePath();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (_) { /* ignore */ }
  return { suggested: {} };
}

function saveState(state) {
  try {
    const f = stateFilePath();
    const dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) { /* best-effort */ }
}

function commandHash(cmd) {
  return crypto.createHash('sha256').update(cmd.trim()).digest('hex').slice(0, 16);
}

function markSuggested(cmd) {
  const state = loadState();
  state.suggested[commandHash(cmd)] = {
    command: cmd,
    suggestedAt: new Date().toISOString(),
  };
  saveState(state);
}

function wasAlreadySuggested(cmd) {
  const state = loadState();
  return !!state.suggested[commandHash(cmd)];
}



// ── Analyze history for repeated commands ──

function analyzeHistory(lastLines, minCount) {
  const lines = parseHistoryFile(lastLines);
  if (lines.length === 0) return [];

  const countByCmd = countCommandFrequency(lines);

  // Filter by min count, sort by frequency
  const candidates = Object.entries(countByCmd)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Exclude existing snippets AND already-suggested commands
  const notExisting = filterExisting(Object.fromEntries(candidates));
  const newSuggestions = notExisting
    .filter(([cmd]) => !wasAlreadySuggested(cmd))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return newSuggestions;
}

// ── Interactive save prompt ──

async function promptSaveSuggestion(cmd, count, index, total) {
  const suggestedName = generateName(cmd);
  const lang = detectLanguage(cmd);
  const langIcon = icons.getLangIcon(lang);

  const cols = Math.min(process.stdout.columns || 80, 64);
  console.log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));
  const headerLine = ` ${c.brand(String(index) + '/' + String(total))} ${c.badge(count + '×')}  ${c.brand(suggestedName)}  ${c.code(langIcon + ' ' + lang)}`;
  const headerPadding = Math.max(0, cols - 2 - stripAnsi(headerLine).length - 1);
  console.log(c.border('  │') + headerLine + ' '.repeat(headerPadding) + c.border('│'));

  // Show the command with one-line truncation
  const displayCmd = cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd;
  const cmdLine = ` ${c.dim(displayCmd)}`;
  const cmdPadding = Math.max(0, cols - 2 - stripAnsi(cmdLine).length - 1);
  console.log(c.border('  │') + cmdLine + ' '.repeat(cmdPadding) + c.border('│'));
  console.log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));

  const answer = await question(c.dim('  Save as snippet? ') + c.brand('[Y/n/a/q]') + c.dim(': '));
  const lower = answer.trim().toLowerCase();

  if (lower === 'q' || lower === 'quit') return 'quit';
  if (lower === 'a' || lower === 'all') return 'all';
  if (lower === '' || lower === 'y' || lower === 'yes') return 'save';
  return 'skip';
}

// ── Save a command as snippet ──

function saveCommand(cmd) {
  const suggestedName = generateName(cmd);
  const lang = detectLanguage(cmd);
  try {
    storage.addSnippet({
      name: suggestedName,
      content: cmd,
      language: lang,
      tags: ['from-history'],
    });
    return true;
  } catch (e) {
    console.error(c.err(`  ${icons.cross} Failed to save: ${e.message}`));
    return false;
  }
}

// ── Main watcher loop ──

async function watchHistoryCmd(opts = {}) {
  const interval = Math.max(10, parseInt(opts.interval) || DEFAULT_INTERVAL);
  const last = Math.min(Math.max(10, parseInt(opts.last) || DEFAULT_LAST), 5000);
  const minCount = Math.max(2, parseInt(opts.minCount) || MIN_COUNT);
  const autoSave = opts.auto || false;
  const runOnce = opts.once || false;

  // Check history exists
  const histPath = getHistoryPath();
  if (!fs.existsSync(histPath)) {
    console.error(c.err(`  ✗ History file not found: ${histPath}`));
    console.log(c.dim('  Set HISTFILE or use bash/zsh with default history path.'));
    setExitCode(1);
    return;
  }

  console.log('');
  console.log(c.brand('  ╭──────────────────────────────────────────────╮'));
  console.log(c.brand('  │') + c.brand('    ' + icons.eye + ' Watching shell history...   ') + c.brand('│'));
  console.log(c.brand('  ╰──────────────────────────────────────────────╯'));
  console.log('');
  console.log(c.dim('  History: ') + c.code(histPath));
  console.log(c.dim('  Checking last ') + c.brand(String(last)) + c.dim(' lines every ') + c.brand(String(interval)) + c.dim('s'));
  console.log(c.dim('  Minimum run count: ') + c.brand(String(minCount)) + c.dim('×'));
  if (autoSave) console.log(c.dim('  Mode: ') + c.brand('auto-save'));
  console.log('');
  console.log(c.muted("  Detects commands you've run multiple times and"));
  console.log(c.muted('  offers to save them as snippets.'));
  console.log('');

  let cycleCount = 0;
  let stopped = false;

  // Handle Ctrl+C
  process.once('SIGINT', () => {
    if (stopped) return;
    stopped = true;
    console.log('');
    console.log(c.dim('  ' + icons.check + ' Watch stopped.'));
    console.log('');
    setExitCode(0);
  });

  async function runCycle() {
    if (stopped) return;

    cycleCount++;
    const suggestions = analyzeHistory(last, minCount);

    if (suggestions.length > 0) {
      console.log(c.accent(`  ${icons.search} Found ${suggestions.length} command${suggestions.length > 1 ? 's' : ''} repeated ${minCount}+ times:`));
      console.log('');

      let saved = 0;
      let skipped = 0;

      for (let i = 0; i < suggestions.length; i++) {
        if (stopped) break;
        const [cmd, count] = suggestions[i];

        // Mark as suggested immediately to avoid re-prompting
        markSuggested(cmd);

        if (autoSave) {
          if (saveCommand(cmd)) {
            saved++;
            console.log(`  ${c.success(icons.check)} ${c.brand(generateName(cmd))} ${c.dim('(' + count + '×)')}`);
          }
        } else {
          const action = await promptSaveSuggestion(cmd, count, i + 1, suggestions.length);

          if (action === 'quit') {
            console.log(c.muted(`  Stopped. Saved ${saved}, skipped ${skipped}.`));
            stopped = true;
            break;
          }

          if (action === 'all') {
            // Save this one
            if (saveCommand(cmd)) saved++;
            else skipped++;
            // Save remaining
            for (let j = i + 1; j < suggestions.length; j++) {
              if (stopped) break;
              const [restCmd, restCount] = suggestions[j];
              if (saveCommand(restCmd)) {
                saved++;
                console.log(`  ${c.success(icons.check)} ${c.brand(generateName(restCmd))} ${c.dim('(' + restCount + '×)')}`);
              } else {
                skipped++;
              }
            }
            stopped = true; // Stop after saving all
            break;
          }

          if (action === 'save') {
            if (saveCommand(cmd)) {
              saved++;
              console.log(`  ${c.success(icons.check)} Saved "${generateName(cmd)}"`);
            } else {
              skipped++;
            }
          } else {
            skipped++;
            console.log(c.muted(`  Skipped.`));
          }
          console.log('');
        }
      }

      // Summary
      if (!stopped && !runOnce) {
        if (saved > 0) {
          console.log(c.success(`  ${icons.check} Saved ${saved} snippet${saved === 1 ? '' : 's'}`));
          if (skipped > 0) console.log(c.muted(`  Skipped ${skipped}`));
          console.log('');
        }
      }
    }

    if (stopped) return;

    if (runOnce) {
      console.log(c.dim(`  ${icons.check} Check complete.`));
      console.log('');
      return;
    }

    // Schedule next cycle
    if (!stopped) {
      console.log(c.dim(`  ${icons.usage} Next check in ${interval}s (Ctrl+C to stop)...`));
      console.log('');
      setTimeout(() => {
        runCycle().catch(() => {});
      }, interval * 1000);
    }
  }

  // Run first cycle immediately
  await runCycle();

  // If runOnce, we're done — let the process exit naturally
  if (runOnce) return;

  // Keep the process alive for polling, but only if not stopped
  if (!stopped) {
    // The setTimeout chain in runCycle keeps the event loop alive
    // We keep a reference to allow graceful shutdown
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (stopped) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }
}

module.exports = watchHistoryCmd;
