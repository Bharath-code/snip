/**
 * Centralized color helpers — graceful fallback when chalk unavailable or NO_COLOR set.
 * Use this instead of defining chalk/colors in each command.
 * Respects process.env.NO_COLOR and --no-color (set by cli.js preAction).
 */
let chalk = null;
try {
  const m = require('chalk');
  chalk = (m && m.default) ? m.default : m;
  if (process.env.NO_COLOR) chalk = null;
} catch (_) {}

const c = {
  accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  dim: (t) => chalk ? chalk.dim(t) : t,
  warn: (t) => chalk ? chalk.yellow.bold(t) : t,
  err: (t) => chalk ? chalk.red.bold(t) : t,
  success: (t) => chalk ? chalk.green(t) : t,
  name: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
  tag: (t) => chalk ? chalk.hex('#F5A623')(t) : t,
  muted: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
  badge: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
  val: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
};

module.exports = { c, chalk };
