/**
 * lib/language-detect.js — Shared language detection for snip.
 *
 * Consolidates duplicated detectLanguage functions from:
 *   - lib/commands/import-history.js
 *   - lib/commands/watch-history.js
 *   - lib/commands/team.js
 *   - lib/mcp-server.js (handleSave)
 *   - lib/commands/grab.js (URL extension + shebang detection)
 *
 * Two detection strategies:
 *   detectLanguageFromCommand(cmd)  — first-word mapping for shell commands
 *   detectLanguageFromUrl(url, content) — file extension + shebang for URLs
 */

// ── Command-first-word mapping (superset of all previous copies) ──

const COMMAND_LANG_MAP = {
  // Interpreters → their language
  'node': 'js',
  'nodejs': 'js',
  'python': 'python',
  'python3': 'python',
  'ruby': 'ruby',
  'perl': 'perl',
  'php': 'php',
  'go': 'go',
  'rust': 'rust',
  'cargo': 'rust',
  'java': 'java',
  'lua': 'lua',
  'r': 'r',
  'Rscript': 'r',

  // Shell tools → bash
  'docker': 'bash',
  'docker-compose': 'bash',
  'kubectl': 'bash',
  'helm': 'bash',
  'terraform': 'bash',
  'git': 'bash',
  'npm': 'bash',
  'yarn': 'bash',
  'pnpm': 'bash',
  'npx': 'bash',
  'make': 'bash',
  'ssh': 'bash',
  'curl': 'bash',
  'wget': 'bash',
  'ls': 'bash',
  'cd': 'bash',
  'echo': 'bash',
  'cat': 'bash',
  'grep': 'bash',
  'find': 'bash',
  'sed': 'bash',
  'awk': 'bash',
  'sort': 'bash',
  'ps': 'bash',
  'top': 'bash',
  'kill': 'bash',
  'mkdir': 'bash',
  'rm': 'bash',
  'cp': 'bash',
  'mv': 'bash',
  'chmod': 'bash',
  'chown': 'bash',
  'tar': 'bash',
  'unzip': 'bash',
  'ssh': 'bash',
  'scp': 'bash',
  'rsync': 'bash',
  'apt': 'bash',
  'apt-get': 'bash',
  'yum': 'bash',
  'brew': 'bash',
  'systemctl': 'bash',
  'journalctl': 'bash',
};

// ── URL extension → language mapping ──

const EXT_LANG = {
  sh: 'sh',
  bash: 'bash',
  zsh: 'zsh',
  fish: 'fish',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'ts',
  tsx: 'ts',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  ps1: 'powershell',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  toml: 'toml',
  md: 'markdown',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'c++',
  h: 'c',
  hpp: 'c++',
  swift: 'swift',
  kt: 'kotlin',
  lua: 'lua',
  r: 'r',
  R: 'r',
};

// ── Shebang → language mapping ──

const SHEBANG_MAP = {
  'bash': 'bash',
  'sh': 'sh',
  'zsh': 'zsh',
  'fish': 'fish',
  'python': 'python',
  'python3': 'python',
  'node': 'js',
  'perl': 'perl',
  'ruby': 'ruby',
  'php': 'php',
  'lua': 'lua',
  'Rscript': 'r',
  'R': 'r',
};

// ── Public API ──

/**
 * Detect language from a shell command by extracting the first word.
 * Used by import-history, watch-history, team, and mcp-server.
 *
 * @param {string} cmd - A shell command string (e.g. "docker run --rm -it ubuntu bash")
 * @returns {string} Detected language (e.g. "bash", "python", "sh")
 */
function detectLanguageFromCommand(cmd) {
  const firstWord = (cmd || '').split(/\s+/)[0]?.replace(/^.*\//, '') || '';
  return COMMAND_LANG_MAP[firstWord] || 'sh';
}

/**
 * Detect language from a URL by checking file extension, then shebang.
 * Used by grab command.
 *
 * @param {string} url - The source URL
 * @param {string} [content] - Optional file content to check shebang
 * @returns {string} Detected language (e.g. "bash", "python", "js") or empty string
 */
function detectLanguageFromUrl(url, content) {
  // Try file extension first
  const ext = (url || '').split('?')[0].split('.').pop()?.toLowerCase();
  if (ext && EXT_LANG[ext]) return EXT_LANG[ext];

  // Try shebang line
  if (content) {
    const firstLine = content.split('\n')[0] || '';
    if (firstLine.startsWith('#!')) {
      for (const [interpreter, lang] of Object.entries(SHEBANG_MAP)) {
        if (firstLine.includes(interpreter)) return lang;
      }
    }
  }

  return '';
}

module.exports = {
  detectLanguageFromCommand,
  detectLanguageFromUrl,
  COMMAND_LANG_MAP,
  EXT_LANG,
  SHEBANG_MAP,
};
