const fs = require('fs');
const storage = require('../storage');

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
      console.error(`Import rejected: file is ${(stat.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB).`);
      process.exitCode = 1;
      return;
    }

    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error(`Import failed: invalid JSON — ${parseErr.message}`);
      process.exitCode = 1;
      return;
    }

    // S-IMPORT-2: Schema validation — must be array or { snippets: [...] }
    let list;
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.snippets)) {
      list = parsed.snippets;
    } else {
      console.error('Import failed: JSON must be an array of snippets or { "snippets": [...] }.');
      process.exitCode = 1;
      return;
    }

    // S-IMPORT-3: Cap import count
    if (list.length > MAX_IMPORT_COUNT) {
      console.error(`Import rejected: ${list.length} snippets exceeds max of ${MAX_IMPORT_COUNT}.`);
      process.exitCode = 1;
      return;
    }

    if (list.length === 0) {
      console.error('Import failed: no snippets found in file.');
      process.exitCode = 1;
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

    console.log(`Imported ${imported} snippet${imported !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`);
  } catch (e) {
    console.error(`Import failed: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = importCmd;
