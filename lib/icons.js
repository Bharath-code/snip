/**
 * Unicode iconography for snip CLI.
 * Using universally-supported Unicode symbols for cross-platform terminal compatibility.
 */

// Status icons
const status = {
  success: '✓',
  warning: '⚠',
  error: '✗',
  info: 'ℹ',
  loading: '...',
  sparkles: '✨',
  fire: '🔥',
  rocket: '🚀',
  star: '★',
};

// Action icons
const action = {
  add: '+',
  edit: '✎',
  delete: '×',
  copy: '⎘',
  run: '▶',
  search: '⌘',
  list: '☰',
  filter: '⚡',
  sort: '↕',
  settings: '⚙',
  help: '?',
  close: '✕',
};

// Navigation icons
const nav = {
  chevronRight: '›',
  chevronLeft: '‹',
  chevronDown: '▼',
  chevronUp: '▲',
  bullet: '·',
  dot: '●',
  hollow: '○',
  arrow: '›',
  returnArrow: '↩',
};

// Category icons for languages/tags
const category = {
  language: '⚡',
  tag: '🏷',
  folder: '📁',
  clock: '⏱',
  chart: '📊',
  code: '📝',
  terminal: '📟',
  link: '🔗',
};

// Combined icons object for easy import
const icons = {
  ...status,
  ...action,
  ...nav,
  ...category,
  
  // Composite icons for common patterns
  usage: '↻',
  check: '✓',
  cross: '✗',
  warn: '⚠',
  bar: '│',
  dash: '─',
  corner: '╭',
  cornerBR: '╮',
  cornerTL: '╰',
  cornerTR: '╯',
  tee: '├',
  crossBar: '┼',
  
  // Language shortcuts
  lang: {
    sh: '⚡',
    bash: '⚡',
    zsh: '⚡',
    javascript: '📜',
    js: '📜',
    typescript: '🔷',
    ts: '🔷',
    python: '🐍',
    py: '🐍',
    ruby: '💎',
    rb: '💎',
    go: '🔶',
    rust: '🦀',
    rs: '🦀',
    java: '☕',
    php: '🐘',
  },
  
  // Get language icon
  getLangIcon(lang) {
    if (!lang) return '📄';
    return this.lang[lang.toLowerCase()] || '📄';
  },
};

module.exports = icons;