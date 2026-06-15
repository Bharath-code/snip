const cfg = require('../config');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');

// Config key schema — type, optional enum values, and description
const CONFIG_SCHEMA = {
  editor:        { type: 'string', desc: 'Editor command (e.g. vim, code --wait, nano)' },
  dataDir:       { type: 'string', desc: 'Directory for snippet content files and DB' },
  dbPath:        { type: 'string', desc: 'JSON database file path' },
  useSqlite:     { type: 'boolean', desc: 'Enable SQLite backend (requires better-sqlite3)' },
  sqlitePath:    { type: 'string', desc: 'SQLite database file path' },
  defaultShell:  { type: 'string', desc: 'Shell used for execution' },
  confirmRun:    { type: 'boolean', desc: 'Show confirmation before running snippets' },
  gist_token:    { type: 'string', sensitive: true, desc: 'GitHub PAT for gist sync' },
  sortMode:      { type: 'string', enum: ['name', 'usage', 'recent'], desc: 'Default sort for snip list' },
  ai_provider:   { type: 'string', enum: ['openai'], desc: 'AI provider' },
  ai_api_key:    { type: 'string', sensitive: true, desc: 'API key for AI provider' },
  ai_model:      { type: 'string', desc: 'Model name for AI generation (e.g. gpt-3.5-turbo)' },
  ai_max_tokens: { type: 'number', desc: 'Max tokens for AI response (1–100000)' },
  teamDir:       { type: 'string', desc: 'Shared snippet directory for team workspace' },
};

const ALLOWED_KEYS = Object.keys(CONFIG_SCHEMA);

function validateValue(key, value) {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) return { valid: false, reason: `Unknown key "${key}". Allowed: ${ALLOWED_KEYS.join(', ')}` };

  // undefined / unset means use default
  if (value === undefined || value === null || value === '') return { valid: true, parsed: undefined };

  const strVal = String(value);

  if (schema.type === 'boolean') {
    if (strVal === 'true' || strVal === '1' || strVal === 'yes') return { valid: true, parsed: true };
    if (strVal === 'false' || strVal === '0' || strVal === 'no') return { valid: true, parsed: false };
    return { valid: false, reason: `Value for "${key}" must be true/false, got "${strVal}"` };
  }

  if (schema.type === 'number') {
    const n = Number(strVal);
    if (isNaN(n) || !isFinite(n)) return { valid: false, reason: `Value for "${key}" must be a number, got "${strVal}"` };
    if (n < 0 || n > 100000) return { valid: false, reason: `Value for "${key}" must be between 0 and 100000` };
    return { valid: true, parsed: n };
  }

  // string type
  if (schema.enum) {
    if (!schema.enum.includes(strVal)) {
      return { valid: false, reason: `Value for "${key}" must be one of: ${schema.enum.join(', ')}, got "${strVal}"` };
    }
    return { valid: true, parsed: strVal };
  }

  return { valid: true, parsed: strVal };
}

function run(action, key, value) {
  if (action === 'get') {
    const cur = cfg.loadConfig();
    if (!key) return console.log(JSON.stringify(cur, null, 2));
    return console.log((cur && cur[key]) !== undefined ? String(cur[key]) : '');
  }

  if (action === 'list') {
    const cur = cfg.loadConfig();
    log('');
    log('  Config keys:');
    log('');
    for (const k of ALLOWED_KEYS) {
      const schema = CONFIG_SCHEMA[k];
      const current = cur[k] !== undefined ? String(cur[k]) : '(unset)';
      const typeLabel = schema.sensitive ? 'sensitive' : schema.type;
      const enumHint = schema.enum ? ` [${schema.enum.join('|')}]` : '';
      log(`  ${k}`);
      log(`    type: ${typeLabel}${enumHint}`);
      log(`    current: ${schema.sensitive ? '***' : current}`);
      log(`    ${schema.desc}`);
      log('');
    }
    return;
  }

  if (action === 'set') {
    if (!key) {
      console.error(c.err('  ✗ Key required for set'));
      setExitCode(2);
      return;
    }
    const check = validateValue(key, value);
    if (!check.valid) {
      console.error(c.err(`  ✗ ${check.reason}`));
      setExitCode(2);
      return;
    }
    if (check.parsed === undefined) {
      console.error(c.err('  ✗ Value required for set'));
      setExitCode(2);
      return;
    }
    const obj = {};
    obj[key] = check.parsed;
    cfg.saveConfig(obj);
    return log('OK');
  }

  console.error(c.err('  ✗ Unknown action. Use get, set, or list.'));
  setExitCode(2);
}

module.exports = run;
module.exports.validateValue = validateValue;
module.exports.CONFIG_SCHEMA = CONFIG_SCHEMA;
