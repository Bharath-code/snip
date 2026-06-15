/**
 * Reusable formatting utilities for Claude Code-inspired CLI output.
 * Provides box drawing, tables, progress indicators, stat cards, and other UI components.
 */

const { c } = require('./colors');
const icons = require('./icons');
const { isQuiet } = require('./quiet');

/**
 * Strip ANSI codes from string (for width calculation)
 */
function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Draw a section header with box drawing
 * @param {string} title - Section title
 * @param {object} options
 * @param {string} options.icon - Leading icon
 * @param {function} options.color - Color function
 * @returns {string}
 */
function section(title, options = {}) {
  if (isQuiet()) return '';
  const { icon = '', color = c.brand } = options;
  const cols = Math.min(process.stdout.columns || 80, 80);
  const iconStr = icon ? icon + ' ' : '';
  const content = iconStr + title;
  const lineWidth = Math.max(3, cols - stripAnsi(content).length - 6);
  const lineStr = c.dim(' ' + '─'.repeat(lineWidth));
  return '\n  ' + color(content) + lineStr + '\n';
}

/**
 * Draw a bordered box around content
 * @param {string} content - The content to wrap
 * @param {object} options
 * @returns {string} Formatted box
 */
function box(content, options = {}) {
  if (isQuiet()) return '';
  const {
    title = '',
    width = Math.min(process.stdout.columns || 80, 72),
    padding = 1,
    borderColor = c.border,
    titleColor = c.brand,
  } = options;

  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length), stripAnsi(title).length);
  const boxWidth = Math.min(Math.max(maxWidth + padding * 2 + 4, 30), width);

  let result = borderColor('  ┌' + '─'.repeat(boxWidth - 2) + '┐') + '\n';

  if (title) {
    const paddedTitle = ` ${titleColor(title)} `;
    const titleLen = stripAnsi(title).length + 2;
    const titlePadding = boxWidth - 2 - titleLen;
    result += borderColor('  │') + paddedTitle + ' '.repeat(Math.max(0, titlePadding)) + borderColor('│') + '\n';
    result += borderColor('  ├' + '─'.repeat(boxWidth - 2) + '┤') + '\n';
  }

  for (const line of lines) {
    const paddingLeft = ' '.repeat(padding);
    const lineLen = stripAnsi(line).length;
    const paddingRight = ' '.repeat(Math.max(0, boxWidth - 2 - lineLen - padding));
    result += borderColor('  │') + paddingLeft + line + paddingRight + borderColor('│') + '\n';
  }

  result += borderColor('  └' + '─'.repeat(boxWidth - 2) + '┘');
  return result;
}

/**
 * Draw a simple info/warning/error message box
 */
function messageBox(message, type = 'info') {
  if (isQuiet()) return '';
  const styles = {
    info: { icon: icons.info, color: c.info },
    success: { icon: icons.check, color: c.success },
    warning: { icon: icons.warn, color: c.warn },
    error: { icon: icons.cross, color: c.err },
  };

  const style = styles[type] || styles.info;
  const lines = message.split('\n');
  const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(Math.max(maxWidth + 6, 30), (process.stdout.columns || 80) - 4);

  const top = style.color('  ┌' + '─'.repeat(boxWidth - 2) + '┐');
  const bottom = style.color('  └' + '─'.repeat(boxWidth - 2) + '┘');

  let result = '\n' + top + '\n';
  for (const line of lines) {
    const padding = ' '.repeat(Math.max(0, boxWidth - 2 - stripAnsi(line).length - 1));
    result += style.color('  │') + ' ' + line + padding + style.color('│') + '\n';
  }
  result += bottom + '\n';

  return result;
}

/**
 * Create a progress bar
 * @param {number} progress - 0 to 1
 * @param {object} options
 * @returns {string}
 */
function progressBar(progress, options = {}) {
  const {
    width = 24,
    filledChar = '█',
    emptyChar = '░',
    showPercent = true,
    color = c.brand,
  } = options;

  const filled = Math.round(progress * width);
  const empty = width - filled;
  const percent = Math.round(progress * 100);

  const bar = color(filledChar.repeat(filled)) + c.dim(emptyChar.repeat(empty));
  return showPercent ? `${bar}  ${percent}%` : bar;
}

/**
 * Format a table with proper alignment
 */
function table(rows, options = {}) {
  if (!rows || rows.length === 0) return '';

  const { headers = [], padding = 2 } = options;

  const colWidths = headers.map((h) => stripAnsi(h).length);
  rows.forEach(row => {
    row.forEach((cell, i) => {
      const len = stripAnsi(String(cell)).length;
      colWidths[i] = Math.max(colWidths[i] || 0, len);
    });
  });

  const separator = c.border('├' + colWidths.map(w => '─'.repeat(w + padding)).join('┼').slice(1) + '┤');
  const topBorder = c.border('┌' + colWidths.map(w => '─'.repeat(w + padding)).join('┬').slice(1) + '┐');
  const bottomBorder = c.border('└' + colWidths.map(w => '─'.repeat(w + padding)).join('┴').slice(1) + '┘');

  let result = topBorder + '\n';

  if (headers.length > 0) {
    result += c.border('│');
    headers.forEach((h, i) => {
      const pad = ' '.repeat(colWidths[i] - stripAnsi(h).length + padding);
      result += ' ' + c.heading(h) + pad;
    });
    result += c.border('│') + '\n';
    result += separator + '\n';
  }

  rows.forEach(row => {
    result += c.border('│');
    row.forEach((cell, i) => {
      const str = String(cell);
      const pad = ' '.repeat(colWidths[i] - stripAnsi(str).length + padding);
      result += ' ' + str + pad;
    });
    result += c.border('│') + '\n';
  });

  result += bottomBorder;
  return result;
}

/**
 * Format a list with bullet points
 */
function list(items, options = {}) {
  const { icon = icons.bullet, indent = 2 } = options;
  const prefix = ' '.repeat(indent) + icon + ' ';

  return items.map(item => {
    if (typeof item === 'string') return prefix + item;
    const { text, style } = item;
    const styledText = style ? style(text) : text;
    return prefix + styledText;
  }).join('\n');
}

/**
 * Create a stat card for inline metrics display
 * @param {string} label
 * @param {string|number} value
 * @param {object} options
 * @returns {string}
 */
function statCard(label, value, options = {}) {
  const { icon = '', color = c.brand, subtext = '' } = options;
  const iconStr = icon ? icon + ' ' : '';
  const subtextStr = subtext ? ' ' + c.muted(subtext) : '';
  const val = String(value);
  return `${iconStr}${color(val.padStart(6))} ${c.muted(label)}${subtextStr}`;
}

/**
 * Format a row of stat cards
 * @param {Array<{label: string, value: *}>} stats
 * @returns {string}
 */
function statRow(stats) {
  return stats.map(s => {
    const icon = s.icon || '';
    const val = String(s.value).padStart(5);
    return `  ${icon} ${c.brand(val)} ${c.muted(s.label)}`;
  }).join('    ');
}

/**
 * Create a card-style box for showing a snippet
 * @param {object} snippet - snippet object with name, language, tags, usageCount
 * @param {string} content - snippet content to display (optional)
 * @param {object} options
 * @returns {string}
 */
function snippetCard(snippet, content, options = {}) {
  if (isQuiet()) return JSON.stringify({ name: snippet.name, language: snippet.language, tags: snippet.tags, content });
  const { showContent = true } = options;
  const cols = Math.min(process.stdout.columns || 80, 72);
  const boxWidth = Math.min(cols, 72);

  let result = c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐') + '\n';

  // Title line
  const langIcon = icons.getLangIcon(snippet.language);
  const langStr = snippet.language ? `${langIcon} ${snippet.language}` : '';
  const titleStr = ` ${icons.edit} ${c.brand(snippet.name)}`;
  const metaRight = langStr ? c.code(' ' + langStr) : '';
  const titleLine = titleStr + (metaRight ? c.muted('  · ') + metaRight : '');
  const padding = Math.max(0, boxWidth - 2 - stripAnsi(titleLine).length - 1);
  result += c.border('  │') + titleLine + ' '.repeat(padding) + c.border('│') + '\n';

  // Meta line (tags, usage)
  if (snippet.tags && snippet.tags.length || snippet.usageCount) {
    const metaParts = [];
    if (snippet.tags && snippet.tags.length) metaParts.push(c.tag(`${icons.tag} ${snippet.tags.join(', ')}`));
    if (snippet.usageCount) metaParts.push(c.dim(`${icons.usage} ${snippet.usageCount} runs`));
    const metaStr = metaParts.join(c.muted('  ·  '));
    const metaLen = stripAnsi(metaStr).length;
    const metaPadding = Math.max(0, boxWidth - 2 - metaLen - 1);
    result += c.border('  │') + metaStr + ' '.repeat(metaPadding) + c.border('│') + '\n';
  }

  if (showContent && content) {
    result += c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤') + '\n';

    const contentLines = content.split('\n').slice(0, 12);
    for (const line of contentLines) {
      const safeLine = line || '';
      const displayLine = ' ' + c.code(safeLine);
      const lineLen = stripAnsi(displayLine).length;
      const linePadding = Math.max(0, boxWidth - 2 - lineLen - 1);
      result += c.border('  │') + displayLine + ' '.repeat(linePadding) + c.border('│') + '\n';
    }
    if (contentLines.length >= 12) {
      result += c.border('  │') + c.muted('  ... (truncated)').padEnd(boxWidth - 2) + c.border('│') + '\n';
    }
  }

  result += c.border('  └' + '─'.repeat(boxWidth - 2) + '┘');
  return result;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength = 40) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function relativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

/**
 * Create an inline hint/footer showing available actions
 */
function actionHint(actions) {
  if (isQuiet()) return '';
  return c.muted('  ') + actions.map(a => {
    const [key, desc] = a.split(':');
    return `${c.brand(key)}${c.muted(' ' + desc)}`;
  }).join(c.muted('  ·  '));
}

/**
 * Loading spinner animation frames
 */
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let _spinnerIndex = 0;
let _spinnerInterval = null;

function spinner() {
  const frame = spinnerFrames[_spinnerIndex];
  _spinnerIndex = (_spinnerIndex + 1) % spinnerFrames.length;
  return frame;
}

function resetSpinner() {
  _spinnerIndex = 0;
  if (_spinnerInterval) {
    clearInterval(_spinnerInterval);
    _spinnerInterval = null;
  }
}

/**
 * Show a temporary inline message that auto-clears
 */
function flashMessage(message, color = c.muted) {
  process.stdout.write('\r' + color(' ' + message));
  setTimeout(() => {
    process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
  }, 2000);
}

module.exports = {
  section,
  box,
  messageBox,
  progressBar,
  table,
  list,
  statCard,
  statRow,
  snippetCard,
  truncate,
  relativeTime,
  actionHint,
  stripAnsi,
  spinner,
  resetSpinner,
  flashMessage,
  icons,
};
