/**
 * snip import-history — analyze shell history, suggest and save commands run 3+ times.
 *
 * Usage:
 *   snip import-history                    # Show suggestions (default)
 *   snip import-history --interactive      # Walk through each suggestion, save with confirmation
 *   snip import-history --auto             # Auto-save all suggestions without prompting
 *   snip import-history --json             # Machine-readable output
 *   snip import-history --last 1000        # Analyze last 1000 history lines
 *   snip import-history --min-count 5      # Only suggest commands run 5+ times
 */
const fs = require('fs');
const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const { question } = require('../readline');
const { actionHint, stripAnsi } = require('../format');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');
const {
  getHistoryPath,
  generateName,
  detectLanguage,
  filterExisting,
  parseHistoryFile,
  countCommandFrequency,
} = require('../history');

const DEFAULT_LAST = 500;
const MIN_COUNT = 3;

// ── Main command handler ──────────────────────────────────────────

async function importHistoryCmd(opts = {}) {
  const last = Math.min(Math.max(1, parseInt(opts.last) || DEFAULT_LAST), 10000);
  const minCount = Math.max(2, parseInt(opts.minCount) || MIN_COUNT);
  const interactive = opts.interactive || opts.i || false;
  const autoSave = opts.auto || false;

  const histPath = getHistoryPath();

  if (!fs.existsSync(histPath)) {
    console.error(`History file not found: ${histPath}`);
    console.error('Set HISTFILE or use bash/zsh with default history path.');
    setExitCode(1);
    return;
  }

  // Read and parse history
  const lines = parseHistoryFile(last);
  const countByCmd = countCommandFrequency(lines);

  // Filter by min count, sort by frequency
  const candidates = Object.entries(countByCmd)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Deduplicate against existing snippets
  const suggestions = filterExisting(Object.fromEntries(candidates))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // JSON output
  if (opts.json) {
    const out = suggestions.map(([cmd, n]) => ({
      command: cmd,
      count: n,
      suggestedName: generateName(cmd),
      language: detectLanguage(cmd),
    }));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // No suggestions
  if (suggestions.length === 0) {
    const totalExisting = storage.listSnippets().length;
    console.log(c.muted(`\n  No new commands found.`));
    if (totalExisting > 0) {
      console.log(c.dim(`  You already have ${totalExisting} snippets. Try: snip import-history --last 1000 --min-count 2`));
    } else {
      console.log(c.dim(`  Try: snip import-history --last 1000 --min-count 2`));
    }
    console.log('');
    return;
  }

  // Non-interactive list mode (default)
  if (!interactive && !autoSave) {
    log(c.accent(`\n  Commands run ${minCount}+ times (from last ${last} history lines):`));
    log('');
    suggestions.forEach(([cmd, n], i) => {
      const name = generateName(cmd);
      const lang = detectLanguage(cmd);
      const langIcon = icons.getLangIcon(lang);
      const preview = cmd.length > 55 ? cmd.slice(0, 52) + '...' : cmd;
      console.log(`  ${String(i + 1).padStart(2)}. ${c.badge(n + '×').padEnd(5)} ${c.brand(name).padEnd(22)} ${c.code(langIcon + ' ' + lang).padEnd(8)} ${c.dim(preview)}`);
    });
    log('');
    log(actionHint([
      'snip import-history --interactive:Review & save',
      'snip import-history --auto:Save all',
    ]));
    log('');
    return;
  }

  // ── Interactive save mode ──
  if (interactive) {
    log(c.accent(`\n  ${icons.search} Found ${suggestions.length} commands to review:`));
    log('');

    let saved = 0;
    let skipped = 0;

    for (let i = 0; i < suggestions.length; i++) {
      const [cmd, count] = suggestions[i];
      const suggestedName = generateName(cmd);
      const lang = detectLanguage(cmd);
      const langIcon = icons.getLangIcon(lang);

      // Show the suggestion in a compact card
      const cols = Math.min(process.stdout.columns || 80, 64);
      console.log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));
      const headerLine = ` ${c.brand(String(i + 1) + '.')} ${c.badge(count + '×')}  ${c.brand(suggestedName)}  ${c.code(langIcon + ' ' + lang)}`;
      const headerPadding = Math.max(0, cols - 2 - stripAnsi(headerLine).length - 1);
      console.log(c.border('  │') + headerLine + ' '.repeat(headerPadding) + c.border('│'));

      const cmdLine = ` ${c.dim(cmd.length > 70 ? cmd.slice(0, 67) + '...' : cmd)}`;
      const cmdPadding = Math.max(0, cols - 2 - stripAnsi(cmdLine).length - 1);
      console.log(c.border('  │') + cmdLine + ' '.repeat(cmdPadding) + c.border('│'));
      console.log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));

      // Prompt for action
      const answer = await question(c.dim('  Save as snippet? ') + c.brand('[Y/n/a/q]') + c.dim(': '));
      const lower = answer.trim().toLowerCase();

      if (lower === 'q' || lower === 'quit') {
        console.log(c.muted(`  Stopped. Saved ${saved}, skipped ${skipped}.`));
        break;
      }

      if (lower === 'a' || lower === 'all') {
        // Save this one and all remaining
        try {
          storage.addSnippet({
            name: suggestedName,
            content: cmd,
            language: lang,
            tags: ['from-history'],
          });
          saved++;
          console.log(c.success(`  ${icons.check} Saved "${suggestedName}"`));
        } catch (e) {
          console.error(c.err(`  ${icons.cross} Failed to save: ${e.message}`));
        }

        // Save remaining
        for (let j = i + 1; j < suggestions.length; j++) {
          const [restCmd, restCount] = suggestions[j];
          const restName = generateName(restCmd);
          const restLang = detectLanguage(restCmd);
          try {
            storage.addSnippet({
              name: restName,
              content: restCmd,
              language: restLang,
              tags: ['from-history'],
            });
            saved++;
            console.log(c.success(`  ${icons.check} Saved "${restName}"`));
          } catch (e) {
            console.error(c.err(`  ${icons.cross} Failed to save "${restName}": ${e.message}`));
          }
        }
        break;
      }

      if (lower === '' || lower === 'y' || lower === 'yes') {
        try {
          storage.addSnippet({
            name: suggestedName,
            content: cmd,
            language: lang,
            tags: ['from-history'],
          });
          saved++;
          console.log(c.success(`  ${icons.check} Saved "${suggestedName}"`));
        } catch (e) {
          console.error(c.err(`  ${icons.cross} Failed to save: ${e.message}`));
        }
      } else {
        skipped++;
        console.log(c.muted(`  Skipped.`));
      }
      console.log('');
    }

    // Summary
    console.log(c.accent(`  ─── Done ───`));
    if (saved > 0) {
      console.log(c.success(`  ${icons.check} Saved ${saved} snippet${saved === 1 ? '' : 's'}`));
    }
    if (skipped > 0) {
      console.log(c.muted(`  Skipped ${skipped}`));
    }
    if (saved > 0) {
      console.log(actionHint([
        'snip list:View all',
        'snip run <name>:Run a snippet',
      ]));
    }
    console.log('');
    return;
  }

  // ── Auto-save mode (no prompting) ──
  if (autoSave) {
    console.log(c.dim(`\n  ${icons.search} Auto-saving ${suggestions.length} commands from history...`));
    console.log('');

    let saved = 0;
    let failed = 0;

    for (const [cmd, count] of suggestions) {
      const name = generateName(cmd);
      const lang = detectLanguage(cmd);
      try {
        storage.addSnippet({
          name,
          content: cmd,
          language: lang,
          tags: ['from-history'],
        });
        saved++;
        console.log(`  ${c.success(icons.check)} ${c.brand(name)} ${c.dim('(' + count + '×)')}`);
      } catch (e) {
        failed++;
        console.error(`  ${c.err(icons.cross)} ${name}: ${e.message}`);
      }
    }

    console.log('');
    if (failed === 0) {
      console.log(c.success(`  ${icons.check} Saved ${saved} snippet${saved === 1 ? '' : 's'} from history`));
    } else {
      console.log(c.warn(`  ${icons.check} Saved ${saved}, ${failed} failed`));
    }
    if (saved > 0) {
      console.log(actionHint([
        'snip list:View all',
        'snip run <name>:Run a snippet',
      ]));
    }
    console.log('');
  }
}

module.exports = importHistoryCmd;
module.exports.generateName = generateName;
module.exports.detectLanguage = detectLanguage;
