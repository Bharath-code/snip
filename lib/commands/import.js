const fs = require('fs');
const storage = require('../storage');
const { log } = require('../quiet');
const { c } = require('../colors');
const icons = require('../icons');
const { setExitCode } = require('../cli-utils');

/** @type {number} Max import file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** @type {number} Max snippets per import */
const MAX_IMPORT_COUNT = 500;

/**
 * Validate that a parsed snippet entry has the expected shape.
 * @param {*} entry
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, reason: 'entry is not an object' };
  }
  if (typeof entry.name !== 'string' && entry.name !== undefined) {
    return { valid: false, reason: 'name must be a string' };
  }
  if (typeof entry.content !== 'string' && entry.content !== undefined) {
    return { valid: false, reason: 'content must be a string' };
  }
  if (entry.tags !== undefined && !Array.isArray(entry.tags)) {
    return { valid: false, reason: 'tags must be an array' };
  }
  return { valid: true };
}

function importCmd(file) {
  try {
    // S-IMPORT-1: File size guard
    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_SIZE) {
      console.error(c.err(`  ${icons.cross} File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB).`));
      setExitCode(1);
      return;
    }

    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error(c.err(`  ${icons.cross} Invalid JSON: ${parseErr.message}`));
      setExitCode(1);
      return;
    }

    // S-IMPORT-2: Schema validation — must be array or { snippets: [...] }
    let list;
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.snippets)) {
      list = parsed.snippets;
    } else {
      console.error(c.err(`  ${icons.cross} Invalid format: must be an array of snippets or { "snippets": [...] }.`));
      setExitCode(1);
      return;
    }

    // S-IMPORT-3: Cap import count
    if (list.length > MAX_IMPORT_COUNT) {
      console.error(c.err(`  ${icons.cross} Too many snippets: ${list.length} (max ${MAX_IMPORT_COUNT}).`));
      setExitCode(1);
      return;
    }

    if (list.length === 0) {
      console.error(c.err(`  ${icons.cross} No snippets found in file.`));
      setExitCode(1);
      return;
    }

    // S-IMPORT-4: Validate each entry
    let imported = 0;
    let skipped = 0;
    for (const s of list) {
      const check = validateEntry(s);
      if (!check.valid) {
        skipped++;
        continue;
      }
      storage.addSnippet({
        name: s.name || 'imported',
        content: s.content || '',
        language: s.language,
        tags: s.tags
      });
      imported++;
    }

    log(`Imported ${imported} snippet${imported !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`);
  } catch (e) {
    console.error(c.err(`  ${icons.cross} Import failed: ${e.message}`));
    setExitCode(1);
  }
}

module.exports = importCmd;
