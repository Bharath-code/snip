const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// P3: Track active temp dir for cleanup on SIGINT/SIGTERM
let _activeTmpDir = null;
function _cleanupTmp() {
  if (_activeTmpDir) {
    try { fs.rmSync(_activeTmpDir, { recursive: true, force: true }); } catch (_) { }
    _activeTmpDir = null;
  }
}
process.once('SIGINT', () => { _cleanupTmp(); process.exit(130); });
process.once('SIGTERM', () => { _cleanupTmp(); process.exit(143); });

function normalizeLanguage(language) {
  return String(language || '').trim().toLowerCase();
}

function resolveRunner(language, shell) {
  const lang = normalizeLanguage(language);
  if (lang === 'bash' || lang === 'zsh' || lang === 'sh' || lang === 'ksh' || lang === 'fish') {
    return { command: lang, extension: lang, kind: 'shell' };
  }
  if (lang === 'javascript' || lang === 'js' || lang === 'node' || lang === 'mjs' || lang === 'cjs') {
    return { command: 'node', extension: 'js', kind: 'javascript' };
  }
  if (lang === 'typescript' || lang === 'ts' || lang === 'tsx') {
    return { command: 'tsx', extension: 'ts', kind: 'typescript' };
  }
  if (lang === 'python' || lang === 'py') {
    return { command: 'python3', extension: 'py', kind: 'python' };
  }
  if (lang === 'ruby' || lang === 'rb') {
    return { command: 'ruby', extension: 'rb', kind: 'ruby' };
  }
  if (lang === 'php') {
    return { command: 'php', extension: 'php', kind: 'php' };
  }
  if (lang === 'perl' || lang === 'pl') {
    return { command: 'perl', extension: 'pl', kind: 'perl' };
  }
  if (lang === 'powershell' || lang === 'ps1') {
    return { command: 'pwsh', extension: 'ps1', kind: 'powershell' };
  }
  return {
    command: shell || process.env.SHELL || 'sh',
    extension: 'sh',
    kind: lang ? `fallback(${lang})` : 'shell'
  };
}

function runSnippetContent(content, opts = {}) {
  if (opts.dryRun) {
    console.log('--- DRY RUN ---');
    console.log(content);
    return 0;
  }

  const runner = resolveRunner(opts.language, opts.shell);
  const run = opts.runner || spawnSync;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-'));
  _activeTmpDir = tmpDir; // P3: register for signal cleanup
  const file = path.join(tmpDir, `snippet.${runner.extension}`);
  fs.writeFileSync(file, content, { mode: 0o700 });

  try {
    const res = run(runner.command, [file], { stdio: 'inherit' });
    if (res.error && res.error.code === 'ENOENT') {
      console.error(`Interpreter not found for "${opts.language || 'shell'}": ${runner.command}`);
      return 127;
    }
    if (typeof res.status === 'number') return res.status;
    if (res.error) {
      console.error('Failed to execute snippet:', res.error.message);
      return 1;
    }
    return 0;
  } finally {
    _activeTmpDir = null;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }
  }
}

module.exports = { runSnippetContent, resolveRunner, normalizeLanguage };
