/**
 * lib/approvals.js — Pending-approval queue for policy-gated snip_exec.
 * Agent requests execution → entry parked here → human runs `snip approve <id>`.
 * Stored as a single JSON array at <dataDir>/approvals.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

function approvalsPath() {
  return path.join(config.loadConfig().dataDir, 'approvals.json');
}

function readAll() {
  try {
    const data = JSON.parse(fs.readFileSync(approvalsPath(), 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_e) {
    return [];
  }
}

function writeAll(entries) {
  config.ensureDirs();
  fs.writeFileSync(approvalsPath(), JSON.stringify(entries, null, 2));
}

function create({ snippet, content, language }) {
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    snippet,
    content,
    language: language || '',
    createdAt: new Date().toISOString(),
  };
  const entries = readAll();
  entries.push(entry);
  writeAll(entries);
  return entry;
}

function get(id) {
  return readAll().find(e => e.id === id) || null;
}

function remove(id) {
  const entries = readAll();
  const remaining = entries.filter(e => e.id !== id);
  if (remaining.length === entries.length) return false;
  writeAll(remaining);
  return true;
}

module.exports = { create, get, list: readAll, remove, approvalsPath };
