/**
 * lib/history.js — Shared shell history analysis functions.
 *
 * Used by:
 *   - snip import-history (lib/commands/import-history.js)
 *   - snip watch-history  (lib/commands/watch-history.js)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const storage = require('./storage');
const { detectLanguageFromCommand } = require('./language-detect');

const MIN_CMD_LEN = 4;

// ── History file discovery ──────────────────────────────────────────

/**
 * Find the shell history file path.
 * Checks HISTFILE env var, then falls back to ~/.zsh_history or ~/.bash_history.
 */
function getHistoryPath() {
  const histfile = process.env.HISTFILE;
  if (histfile && fs.existsSync(histfile)) return histfile;
  const shell = (process.env.SHELL || '').toLowerCase();
  const home = os.homedir();
  if (shell.includes('zsh')) return path.join(home, '.zsh_history');
  if (shell.includes('bash')) return path.join(home, '.bash_history');
  return path.join(home, '.zsh_history');
}

// ── Line parsers ────────────────────────────────────────────────────

function parseZshLine(line) {
  const m = line.match(/^: \d+:\d+;(.*)/);
  return m ? m[1].trim() : line.trim();
}

function parseBashLine(line) {
  return line.trim();
}

// ── Name generation ────────────────────────────────────────────────

/**
 * Generate a kebab-case snippet name from a shell command.
 * Extracts the primary command (first word) and key flags/arguments.
 */
function generateName(cmd) {
  const clean = cmd
    .replace(/^[A-Z_]+=\S*\s+/g, '')    // Strip VAR=value prefixes
    .replace(/\s*[|>]<.*$/g, '')         // Strip pipes and redirects
    .trim();

  const parts = clean.split(/\s+/);
  if (parts.length === 0) return 'cmd';

  const primary = parts[0].replace(/^.*\//, ''); // Strip path from command

  // Extract significant flags/args (--long-flag, or meaningful words, exclude single-letter flags)
  const flags = parts.slice(1).filter(p => {
    if (p.startsWith('--')) return true;                      // --flag
    if (/^-[a-zA-Z]$/.test(p)) return false;                  // Skip single-letter flags (-d, -f)
    if (p.startsWith('-') && p.length > 2) return true;       // -abc (multi-char short flags)
    // Include meaningful words (not paths, not values)
    if (/^[a-zA-Z][a-zA-Z0-9_]{2,20}$/.test(p) && !p.startsWith('$')) return true;
    return false;
  }).slice(0, 3);

  const nameParts = [primary, ...flags];
  let name = nameParts.join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return name || 'cmd';
}

// ── Language detection ────────────────────────────────────────────

/**
 * Detect the most likely language/shell for a command.
 * Returns a language string suitable for storage.
 */
function detectLanguage(cmd) {
  return detectLanguageFromCommand(cmd);
}

// ── Deduplication ─────────────────────────────────────────────────

/**
 * Filter out commands that are already saved as snippets.
 * Checks by normalized content (trimmed, whitespace-collapsed).
 */
function filterExisting(countByCmd) {
  const existing = storage.listSnippets();
  const existingContents = new Set();

  for (const s of existing) {
    const content = storage.readSnippetContent(s);
    if (content) {
      const normalized = content.trim().replace(/\s+/g, ' ');
      existingContents.add(normalized);
    }
  }

  return Object.entries(countByCmd)
    .filter(([cmd]) => {
      const normalized = cmd.trim().replace(/\s+/g, ' ');
      return !existingContents.has(normalized);
    });
}

// ── History parsing and analysis ──────────────────────────────────

/**
 * Parse shell history file and return array of command strings.
 * @param {number} lastLines - Number of recent lines to analyze
 * @returns {string[]} Parsed command lines
 */
function parseHistoryFile(lastLines) {
  const histPath = getHistoryPath();
  if (!fs.existsSync(histPath)) return [];

  const raw = fs.readFileSync(histPath, 'utf8');
  const isZsh = histPath.includes('zsh_history');
  return raw.split('\n').slice(-lastLines).map(l => isZsh ? parseZshLine(l) : parseBashLine(l));
}

/**
 * Count command frequency from parsed lines.
 * @param {string[]} lines - Parsed command lines
 * @param {number} minCmdLen - Minimum command length (default: 4)
 * @returns {Object} Map of normalized command to count
 */
function countCommandFrequency(lines, minCmdLen = MIN_CMD_LEN) {
  const countByCmd = {};
  for (const line of lines) {
    const cmd = line.trim();
    if (cmd.length < minCmdLen) continue;
    // Normalize: collapse whitespace, remove trailing slashes
    const normalized = cmd.replace(/\s+/g, ' ').replace(/\/+$/, '');
    countByCmd[normalized] = (countByCmd[normalized] || 0) + 1;
  }
  return countByCmd;
}

module.exports = {
  getHistoryPath,
  parseZshLine,
  parseBashLine,
  generateName,
  detectLanguage,
  filterExisting,
  parseHistoryFile,
  countCommandFrequency,
  MIN_CMD_LEN,
};
