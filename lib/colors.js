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

// Helper to apply chalk style safely
function stylize(text, style) {
  if (!chalk || !style) return text;
  return style(text);
}

// Claude Code-inspired color palette
const c = {
  // Brand colors - retained from original (#ff4d00 identity)
  brand: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  brandLight: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
  brandDim: (t) => chalk ? chalk.hex('#cc3d00')(t) : t,
  
  // Text hierarchy
  accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t, // Primary emphasis
  name: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,   // Snippet names
  heading: (t) => chalk ? chalk.bold(t) : t,               // Section headers
  
  // Semantic colors
  success: (t) => chalk ? chalk.green(t) : t,
  warn: (t) => chalk ? chalk.yellow.bold(t) : t,
  err: (t) => chalk ? chalk.red.bold(t) : t,
  error: (t) => chalk ? chalk.red.bold(t) : t,
  info: (t) => chalk ? chalk.hex('#3b82f6')(t) : t,        // Blue for info
  
  // Visual elements
  tag: (t) => chalk ? chalk.hex('#f59e0b')(t) : t,         // Amber for tags
  code: (t) => chalk ? chalk.hex('#a78bfa')(t) : t,        // Purple for code
  path: (t) => chalk ? chalk.hex('#34d399')(t) : t,        // Emerald for paths
  
  // Neutral hierarchy
  text: (t) => chalk ? chalk.hex('#f5f5f5')(t) : t,         // Primary text
  muted: (t) => chalk ? chalk.hex('#a0a0a0')(t) : t,        // Secondary text
  dim: (t) => chalk ? chalk.dim(t) : t,                     // Tertiary/hints
  
  // UI elements
  badge: (t) => chalk ? chalk.hex('#ff7a33').bold(t) : t,  // Usage counts
  val: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,          // Values
  
  // Border/decorative
  border: (t) => chalk ? chalk.hex('#333333')(t) : t,
  borderLight: (t) => chalk ? chalk.hex('#404040')(t) : t,
  
  // Special formatting
  icon: (t) => chalk ? chalk.cyan(t) : t,                   // Icons/symbols
  bullet: (t) => chalk ? chalk.hex('#6C7086')(t) : t,       // Bullet points
  dash: (t) => chalk ? chalk.hex('#404040')(t) : t,         // Decorative dashes
  
  // Combined styles for common patterns
  successBox: (t) => chalk ? chalk.green.bgHex('#1a2e1a').bold(t) : t,
  errorBox: (t) => chalk ? chalk.red.bgHex('#2e1a1a').bold(t) : t,
  warningBox: (t) => chalk ? chalk.yellow.bgHex('#2e2e1a').bold(t) : t,
};

module.exports = { c, chalk };
