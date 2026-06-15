/**
 * snip watch — re-run a snippet when its file is edited.
 *
 * Creates a temp file with the snippet's content, displays the path,
 * and watches for changes. On every save, re-reads the content, updates
 * storage, and executes the snippet. Great for iterating on a script
 * while seeing live output.
 *
 * Usage:
 *   snip watch deploy-api
 *   snip watch deploy-api --editor vim
 *
 * The temp file path is shown so you can open it in any editor.
 * Press Ctrl+C to stop watching.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const storage = require('../storage');
const config = require('../config');
const exec = require('../exec');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');
const icons = require('../icons');

async function watchCmd(idOrName, opts = {}) {
  const snippet = storage.getSnippetByIdOrName(idOrName);
  if (!snippet) {
    console.error(c.err('  ✗ Snippet not found: ') + c.brand('"' + idOrName + '"'));
    setExitCode(1);
    return;
  }

  const content = storage.readSnippetContent(snippet);
  if (!content || !content.trim()) {
    console.error(c.err('  ✗ Snippet "' + snippet.name + '" is empty.'));
    setExitCode(1);
    return;
  }

  const cfg = config.loadConfig();

  // Create temp file
  const tmpFile = path.join(os.tmpdir(), `snip-watch-${snippet.name}-${Date.now()}`);
  try { fs.unlinkSync(tmpFile); } catch (_) { /* doesn't exist yet */ }
  fs.writeFileSync(tmpFile, content, { mode: 0o644 });

  const editor = opts.editor || cfg.editor || process.env.EDITOR || 'vi';

  // Display header
  console.log('');
  console.log(c.brand('  ╭──────────────────────────────────────────────╮'));
  console.log(c.brand('  │') + c.brand('    ' + icons.eye + ' Watching: ') + c.brand(snippet.name) + c.dim('   ') + c.brand('│'));
  console.log(c.brand('  ╰──────────────────────────────────────────────╯'));
  console.log('');
  console.log(c.dim('  File: ') + c.code(tmpFile));
  console.log(c.dim('  Edit the file, then save to re-run.'));
  console.log(c.dim('  Press ') + c.brand('Ctrl+C') + c.dim(' to stop watching.'));
  console.log('');

  // Try to open the editor automatically if the option is set
  // Watch the temp file
  let runCount = 0;
  let debounceTimer = null;
  let watcher = null;
  let stopped = false;
  let watchResolve = null;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (watcher) { watcher.close(); watcher = null; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    try { fs.unlinkSync(tmpFile); } catch (_) { }
    console.log('');
    console.log(c.dim('  ' + icons.check + ' Watch ended. ') + c.brand(runCount + ' run' + (runCount !== 1 ? 's' : '') + ' executed.'));
    console.log('');
    if (watchResolve) {
      watchResolve();
      watchResolve = null;
    }
  }

  // Handle Ctrl+C — set exit code and let the process exit naturally
  process.once('SIGINT', () => {
    setExitCode(0);
    stop();
  });

  watcher = fs.watch(tmpFile, (eventType) => {
    if (stopped) return;
    if (eventType !== 'change') return;

    // Debounce — saves can fire multiple events
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (stopped) return;
      runCount++;
      let newContent;
      try {
        newContent = fs.readFileSync(tmpFile, 'utf8');
      } catch (_) {
        return; // file may have been deleted
      }

      // Update storage with the new content
      try {
        storage.updateSnippetContent(snippet.id, newContent);
      } catch (_) { /* best-effort */ }

      // Print run header
      const now = new Date().toLocaleTimeString();
      console.log('');
      console.log(c.border('  ─── ') + c.brand(icons.run + ' Run #' + runCount) + c.dim(' (' + now + ')') + c.border(' ───'));
      console.log('');

      // Execute the snippet
      const status = exec.runSnippetContent(newContent, {
        dryRun: false,
        shell: cfg.defaultShell,
        language: snippet.language,
      });

      if (status === 0) {
        storage.touchUsage(snippet);
        require('../streak').recordUsage();
        console.log(c.success('  ' + icons.check + ' Completed (exit: ' + status + ')'));
      } else {
        console.log(c.err('  ' + icons.cross + ' Failed (exit: ' + status + ')'));
      }

      console.log(c.dim('  ' + '─'.repeat(40)));
      console.log('');
    }, 300);
  });

  // Wait for the watcher to close (via stop())
  // fs.watch keeps the event loop alive naturally
  await new Promise((resolve) => {
    watchResolve = resolve;
  });
}

module.exports = watchCmd;
