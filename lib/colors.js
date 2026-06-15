/**
 * Centralized color helpers — graceful fallback when chalk unavailable or NO_COLOR set.
 * Use this instead of defining chalk/colors in each command.
 * Respects process.env.NO_COLOR and --no-color (set by cli.js preAction).
 *
 * Claude Code-inspired color palette with warm grays and clear hierarchy.
 */
let chalk = null;
try {
  const m = require('chalk');
  chalk = (m && m.default) ? m.default : m;
  if (process.env.NO_COLOR) chalk = null;
} catch (_) {}

// Claude Code-inspired color palette with warm grays and clear hierarchy
const c = {
  // Brand colors - retained from original (#ff4d00 identity)
  brand: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  brandLight: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
  brandDim: (t) => chalk ? chalk.hex('#cc3d00')(t) : t,
  
  // Text hierarchy
  heading: (t) => chalk ? chalk.bold(t) : t,               // Section headers
  text: (t) => chalk ? chalk.hex('#f5f5f5')(t) : t,         // Primary text
  muted: (t) => chalk ? chalk.hex('#a0a0a0')(t) : t,        // Secondary text
  dim: (t) => chalk ? chalk.dim(t) : t,                     // Tertiary/hints
  
  // Semantic colors
  success: (t) => chalk ? chalk.green(t) : t,
  warn: (t) => chalk ? chalk.yellow.bold(t) : t,
  err: (t) => chalk ? chalk.red.bold(t) : t,
  error: (t) => chalk ? chalk.red.bold(t) : t,
  info: (t) => chalk ? chalk.hex('#3b82f6')(t) : t,        // Blue for info
  
  // Visual elements
  accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t, // Primary emphasis (alias for brand bold)
  name: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,   // Snippet names (alias)
  tag: (t) => chalk ? chalk.hex('#f59e0b')(t) : t,         // Amber for tags
  code: (t) => chalk ? chalk.hex('#a78bfa')(t) : t,        // Purple for code
  path: (t) => chalk ? chalk.hex('#34d399')(t) : t,        // Emerald for paths
  
  // UI elements
  badge: (t) => chalk ? chalk.hex('#ff7a33').bold(t) : t,  // Usage counts
  
  // Border/decorative
  border: (t) => chalk ? chalk.hex('#585B70')(t) : t,       // Catppuccin Mocha surface2
  borderLight: (t) => chalk ? chalk.hex('#6C7086')(t) : t,  // Catppuccin Mocha surface1
  
  // Icons
  icon: (t) => chalk ? chalk.cyan(t) : t,
  bullet: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
  dash: (t) => chalk ? chalk.hex('#585B70')(t) : t,
  
  // Combined styles for message boxes
  successBox: (t) => chalk ? chalk.green.bgHex('#1a2e1a').bold(t) : t,
  errorBox: (t) => chalk ? chalk.red.bgHex('#2e1a1a').bold(t) : t,
  warningBox: (t) => chalk ? chalk.yellow.bgHex('#2e2e1a').bold(t) : t,
  
  // Fire/brand accent for streaks and highlights
  fire: (t) => chalk ? chalk.hex('#ff4d00')(t) : t,
};

module.exports = { c, chalk };
