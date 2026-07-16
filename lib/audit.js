/**
 * lib/audit.js — Append-only audit log for MCP tool calls and approvals.
 * One JSON object per line at <dataDir>/audit.jsonl. Best-effort: auditing
 * must never break the operation being audited.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');

function auditPath() {
  return path.join(config.loadConfig().dataDir, 'audit.jsonl');
}

function append(entry) {
  try {
    config.ensureDirs();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      user: os.userInfo().username,
      ...entry,
    });
    fs.appendFileSync(auditPath(), line + '\n');
  } catch (_e) { /* best-effort */ }
}

function readAll() {
  try {
    return fs.readFileSync(auditPath(), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch (_e) {
    return [];
  }
}

module.exports = { append, readAll, auditPath };
