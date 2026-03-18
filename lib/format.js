/**
 * Reusable formatting utilities for Claude Code-inspired CLI output.
 * Provides box drawing, tables, progress indicators, and other UI components.
 */

const { c } = require('./colors');
const icons = require('./icons');

/**
 * Draw a bordered box around content
 * @param {string} content - The content to wrap
 * @param {object} options - Box options
 * @returns {string} Formatted box
 */
function box(content, options = {}) {
  const {
    title = '',
    width = Math.min(process.stdout.columns || 80, 80),
    padding = 1,
    borderColor = c.border,
  } = options;
  
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length), title.length);
  const boxWidth = Math.min(maxWidth + padding * 2 + 2, width);
  
  const topBorder = borderColor('┌' + '─'.repeat(boxWidth - 2) + '┐');
  const bottomBorder = borderColor('└' + '─'.repeat(boxWidth - 2) + '┘');
  
  let result = topBorder + '\n';
  
  if (title) {
    const paddedTitle = ` ${title} `;
    const titlePadding = boxWidth - 2 - paddedTitle.length;
    result += borderColor('│') + paddedTitle + ' '.repeat(Math.max(0, titlePadding)) + borderColor('│') + '\n';
    result += borderColor('├' + '─'.repeat(boxWidth - 2) + '┤') + '\n';
  }
  
  for (const line of lines) {
    const paddingLeft = ' '.repeat(padding);
    const paddingRight = ' '.repeat(Math.max(0, boxWidth - 2 - stripAnsi(line).length - padding));
    result += borderColor('│') + paddingLeft + line + paddingRight + borderColor('│') + '\n';
  }
  
  result += bottomBorder;
  return result;
}

/**
 * Draw a simple info/warning/error box
 * @param {string} message - The message content
 * @param {string} type - Box type: 'info' | 'success' | 'warning' | 'error'
 * @returns {string} Formatted box
 */
function messageBox(message, type = 'info') {
  const styles = {
    info: { icon: icons.info, color: c.info, bg: c.info },
    success: { icon: icons.success, color: c.success, bg: c.successBox },
    warning: { icon: icons.warning, color: c.warn, bg: c.warningBox },
    error: { icon: icons.error, color: c.err, bg: c.errorBox },
  };
  
  const style = styles[type] || styles.info;
  const lines = message.split('\n');
  const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length));
  const boxWidth = Math.min(maxWidth + 6, (process.stdout.columns || 80) - 4);
  
  const top = style.color('┌' + '─'.repeat(boxWidth - 2) + '┐');
  const bottom = style.color('└' + '─'.repeat(boxWidth - 2) + '┘');
  
  let result = top + '\n';
  for (const line of lines) {
    const padding = ' '.repeat(Math.max(0, boxWidth - 2 - stripAnsi(line).length - 1));
    result += style.color('│') + ' ' + line + padding + style.color('│') + '\n';
  }
  result += bottom;
  
  return result;
}

/**
 * Create a progress bar
 * @param {number} progress - Progress from 0 to 1
 * @param {object} options - Bar options
 * @returns {string} Progress bar string
 */
function progressBar(progress, options = {}) {
  const {
    width = 30,
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
 * @param {Array} rows - Array of row arrays
 * @param {object} options - Table options
 * @returns {string} Formatted table
 */
function table(rows, options = {}) {
  if (!rows || rows.length === 0) return '';
  
  const { headers = [], align = [], padding = 2 } = options;
  
  // Calculate column widths
  const colWidths = headers.map((h, i) => stripAnsi(h).length);
  rows.forEach(row => {
    row.forEach((cell, i) => {
      const len = stripAnsi(String(cell)).length;
      colWidths[i] = Math.max(colWidths[i] || 0, len);
    });
  });
  
  const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (padding * (colWidths.length - 1)) + 2;
  const separator = c.border('├' + colWidths.map(w => '─'.repeat(w + padding)).join('┼').slice(1) + '┤');
  const topBorder = c.border('┌' + colWidths.map(w => '─'.repeat(w + padding)).join('┬').slice(1) + '┐');
  const bottomBorder = c.border('└' + colWidths.map(w => '─'.repeat(w + padding)).join('┴').slice(1) + '┘');
  
  let result = topBorder + '\n';
  
  // Headers
  if (headers.length > 0) {
    result += c.border('│');
    headers.forEach((h, i) => {
      const pad = ' '.repeat(colWidths[i] - stripAnsi(h).length + padding);
      result += ' ' + c.heading(h) + pad;
    });
    result += c.border('│') + '\n';
    result += separator + '\n';
  }
  
  // Rows
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
 * @param {Array} items - List items
 * @param {object} options - List options
 * @returns {string} Formatted list
 */
function list(items, options = {}) {
  const { icon = icons.bullet, indent = 2, color = c.muted } = options;
  const prefix = ' '.repeat(indent) + icon + ' ';
  
  return items.map(item => {
    if (typeof item === 'string') {
      return prefix + item;
    }
    // Object with custom styling
    const { text, style } = item;
    const styledText = style ? style(text) : text;
    return prefix + styledText;
  }).join('\n');
}

/**
 * Create a stat card for displaying metrics
 * @param {string} label - Stat label
 * @param {string|number} value - Stat value
 * @param {object} options - Card options
 * @returns {string} Formatted stat
 */
function statCard(label, value, options = {}) {
  const { icon = '', color = c.brand, subtext = '' } = options;
  const iconStr = icon ? icon + ' ' : '';
  const subtextStr = subtext ? ' ' + c.muted(subtext) : '';
  return `${iconStr}${color(String(value))}${subtextStr}`;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength = 40) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
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
 * Create an inline hint/footer
 * @param {Array} actions - Array of action strings
 * @returns {string} Formatted hint
 */
function actionHint(actions) {
  return c.muted('  ' + actions.map(a => {
    const [key, desc] = a.split(':');
    return `${c.brand(key)}${c.muted(' ' + desc)}`;
  }).join(c.muted('  · ') + '  '));
}

/**
 * Strip ANSI codes from string (for width calculation)
 * @param {string} str - String with potential ANSI codes
 * @returns {string} Plain string
 */
function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create a section header
 * @param {string} title - Section title
 * @param {object} options - Header options
 * @returns {string} Formatted header
 */
function section(title, options = {}) {
  const { icon = '', color = c.brand, line = true } = options;
  const iconStr = icon ? icon + ' ' : '';
  
  if (!line) {
    return color(iconStr + title);
  }
  
  const width = Math.min(process.stdout.columns || 60, 60);
  const content = iconStr + title;
  const lineWidth = width - stripAnsi(content).length - 1;
  const lineStr = c.dim(' ' + '─'.repeat(Math.max(3, lineWidth)));
  
  return color(content) + lineStr;
}

/**
 * Format key-value pairs nicely
 * @param {object} data - Key-value object
 * @param {object} options - Format options
 * @returns {string} Formatted string
 */
function keyValue(data, options = {}) {
  const { keyColor = c.brand, valueColor = c.text, separator = '  ', linePrefix = '  ' } = options;
  const maxKeyLen = Math.max(...Object.keys(data).map(k => stripAnsi(k).length));
  
  return Object.entries(data)
    .map(([key, value]) => {
      const padding = ' '.repeat(maxKeyLen - stripAnsi(key).length);
      return linePrefix + keyColor(key + padding) + separator + valueColor(String(value));
    })
    .join('\n');
}

// Spinner animation frames
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;

/**
 * Get next spinner frame
 * @returns {string} Spinner character
 */
function spinner() {
  const frame = spinnerFrames[spinnerIndex];
  spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  return frame;
}

/**
 * Reset spinner to beginning
 */
function resetSpinner() {
  spinnerIndex = 0;
}

module.exports = {
  box,
  messageBox,
  progressBar,
  table,
  list,
  statCard,
  truncate,
  relativeTime,
  actionHint,
  stripAnsi,
  section,
  keyValue,
  spinner,
  resetSpinner,
  icons,
};