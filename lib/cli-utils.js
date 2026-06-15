/**
 * CLI utilities for snip — shared helpers extracted from cli.js.
 * Handles language shortcut mapping, name:lang parsing, and add:lang syntax.
 */

// Language shortcuts mapping (used by parseNameWithLang and parseAddCommand)
const LANG_SHORTCUTS = {
  'js': 'javascript',
  'ts': 'typescript', 'tsx': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash', 'zsh': 'bash', 'fish': 'bash',
  'go': 'go', 'rs': 'rust', 'java': 'java',
  'c': 'c', 'cpp': 'c++',
  'php': 'php', 'pl': 'perl',
};

/**
 * Parse "name:lang" syntax from a snippet name (e.g., "deploy:sh").
 * Returns { name: string, lang: string|null }.
 */
function parseNameWithLang(name) {
  const match = name.match(/^([^:]+):(\w+)$/);
  if (match) {
    const [, cleanName, langShortcut] = match;
    const lang = LANG_SHORTCUTS[langShortcut] || langShortcut;
    return { name: cleanName, lang };
  }
  return { name, lang: null };
}

/**
 * Parse "add:lang name" syntax for unknown command handling.
 * Returns { lang: string, remainingArgs: string[] } or null.
 */
function parseAddCommand(args) {
  if (args.length === 0) return null;

  const firstArg = args[0];
  const match = firstArg.match(/^add:(\w+)$/);

  if (match) {
    const lang = LANG_SHORTCUTS[match[1]] || match[1];
    const remainingArgs = args.slice(1);
    return { lang, remainingArgs };
  }

  return null;
}

/**
 * Centralized exit-code helpers for snip.
 * All commands should use these instead of directly manipulating process.exitCode
 * or calling process.exit(). This ensures exit behavior is consistent and testable.
 */

/**
 * Set the process exit code without immediately terminating.
 * Use this for normal error returns — lets the process finish naturally.
 * @param {number} code - Exit code (0 = success, 1 = error, 2 = misuse)
 */
function setExitCode(code) {
  process.exitCode = code;
}

/**
 * Set the exit code AND immediately terminate the process.
 * Use sparingly — only for cases requiring immediate shutdown
 * (e.g., TUI cleanup, signal handlers).
 * @param {number} code - Exit code
 */
function exitProcess(code) {
  process.exitCode = code;
  // eslint-disable-next-line local/no-process-exit -- Centralized exit helper, the ONLY place command files should call process.exit()
  process.exit(code);
}

module.exports = { LANG_SHORTCUTS, parseNameWithLang, parseAddCommand, setExitCode, exitProcess };
