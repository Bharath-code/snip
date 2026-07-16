/**
 * lib/policy.js — Team-governed execution policy for snip_exec.
 *
 * Reads .snip/policy.json (checked into the repo, found via team dir
 * detection). Layered on top of lib/safety.js built-in deny rules,
 * which always apply and cannot be disabled by policy.
 *
 * policy.json schema (all fields optional):
 *   {
 *     "deny":  ["regex", ...],        // extra deny patterns (line-matched)
 *     "allow": ["regex", ...],        // if non-empty, content must match one
 *     "allowedLanguages": ["sh"],     // if set, snippet language must be listed
 *     "execRequiresApproval": false,  // gate non-dry-run exec behind snip approve
 *     "maxRuntimeMs": 30000           // kill executions running longer than this
 *   }
 */

const fs = require('fs');
const path = require('path');
const safety = require('./safety');
const team = require('./team');

const POLICY_FILE_NAME = 'policy.json';

function defaults() {
  return {
    deny: [],
    allow: [],
    allowedLanguages: null,
    execRequiresApproval: false,
    maxRuntimeMs: null,
    source: null,
  };
}

/**
 * Load policy from .snip/policy.json, searching upward from dir (or cwd).
 * Returns defaults when no policy file exists or it fails to parse.
 */
function loadPolicy(dir) {
  const policy = defaults();
  const teamDir = team.detectTeamDir(dir);
  if (!teamDir) return policy;

  const file = path.join(teamDir, POLICY_FILE_NAME);
  if (!fs.existsSync(file)) return policy;

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(parsed.deny)) policy.deny = parsed.deny.map(String);
    if (Array.isArray(parsed.allow)) policy.allow = parsed.allow.map(String);
    if (Array.isArray(parsed.allowedLanguages)) {
      policy.allowedLanguages = parsed.allowedLanguages.map(l => String(l).toLowerCase());
    }
    if (typeof parsed.execRequiresApproval === 'boolean') {
      policy.execRequiresApproval = parsed.execRequiresApproval;
    }
    if (typeof parsed.maxRuntimeMs === 'number' && parsed.maxRuntimeMs > 0) {
      policy.maxRuntimeMs = parsed.maxRuntimeMs;
    }
    policy.source = file;
  } catch (_e) {
    // Unparseable policy: fail closed on the file, open on defaults —
    // built-in safety rules still apply.
  }
  return policy;
}

function matchesAny(patterns, content) {
  const lines = String(content).split('\n');
  for (const p of patterns) {
    let re;
    try { re = new RegExp(p, 'i'); } catch { continue; }
    if (lines.some(line => re.test(line))) return p;
  }
  return null;
}

/**
 * Check snippet content + language against built-in safety rules and policy.
 * @returns {{ blocked: boolean, reason: string|null, requiresApproval: boolean, maxRuntimeMs: number|null }}
 */
function checkExec(content, language, policy) {
  const p = policy || loadPolicy();
  const result = {
    blocked: false,
    reason: null,
    requiresApproval: !!p.execRequiresApproval,
    maxRuntimeMs: p.maxRuntimeMs || null,
  };

  if (safety.isDangerous(content)) {
    result.blocked = true;
    result.reason = 'Blocked by built-in deny rule (dangerous command detected)';
    return result;
  }

  const denyHit = matchesAny(p.deny, content);
  if (denyHit) {
    result.blocked = true;
    result.reason = `Blocked by policy deny pattern: ${denyHit}`;
    return result;
  }

  if (p.allowedLanguages && !p.allowedLanguages.includes(String(language || '').toLowerCase())) {
    result.blocked = true;
    result.reason = `Language "${language || 'unknown'}" not in policy allowedLanguages`;
    return result;
  }

  if (p.allow.length > 0 && !matchesAny(p.allow, content)) {
    result.blocked = true;
    result.reason = 'Content matches no policy allow pattern';
    return result;
  }

  return result;
}

module.exports = { loadPolicy, checkExec, POLICY_FILE_NAME };
