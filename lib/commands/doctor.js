/**
 * snip doctor — health check for the snip setup.
 *
 * Usage:
 *   snip doctor
 */

const fs = require('fs');
const { spawnSync } = require('child_process');
const config = require('../config');
const storage = require('../storage');

function doctorCmd() {
    const cfg = config.loadConfig();
    const checks = [];

    // 1. Storage
    const snippets = storage.listSnippets();
    const backend = cfg.useSqlite ? 'SQLite' : 'JSON';
    const dbFile = cfg.useSqlite ? cfg.sqlitePath : cfg.dbPath;
    const dbExists = fs.existsSync(dbFile);
    checks.push({
        label: 'Storage',
        ok: dbExists,
        detail: dbExists
            ? `${backend} (${snippets.length} snippets)`
            : `${backend} — DB file missing: ${dbFile}`
    });

    // 2. Editor
    const editorBin = (cfg.editor || 'vi').split(' ')[0];
    const editorCheck = spawnSync('which', [editorBin], { encoding: 'utf8' });
    checks.push({
        label: 'Editor',
        ok: editorCheck.status === 0,
        detail: editorCheck.status === 0
            ? cfg.editor
            : `${cfg.editor} — not found in PATH`
    });

    // 3. Shell
    const shell = cfg.defaultShell || process.env.SHELL || 'sh';
    checks.push({ label: 'Shell', ok: true, detail: shell });

    // 4. fzf (optional)
    const fzfCheck = spawnSync('which', ['fzf'], { encoding: 'utf8' });
    checks.push({
        label: 'fzf',
        ok: fzfCheck.status === 0,
        detail: fzfCheck.status === 0 ? 'installed' : 'not installed (optional — `snip fzf` needs it)'
    });

    // 5. Gist sync
    const hasToken = !!(cfg.gist_token || process.env.SNIP_GIST_TOKEN);
    checks.push({
        label: 'Gist sync',
        ok: hasToken,
        detail: hasToken ? 'configured' : 'not configured (set SNIP_GIST_TOKEN or snip config set gist_token)'
    });

    // 6. Completions
    const shellName = (process.env.SHELL || '').toLowerCase();
    let completionHint = 'run: eval "$(snip completion)"';
    if (shellName.includes('fish')) completionHint = 'run: snip completion fish | source';
    checks.push({
        label: 'Completions',
        ok: null, // can't detect if loaded
        detail: completionHint
    });

    // Output
    console.log('\n  snip doctor\n');
    for (const c of checks) {
        const icon = c.ok === true ? '✓' : c.ok === false ? '✗' : '?';
        const color = c.ok === true ? '\x1b[32m' : c.ok === false ? '\x1b[31m' : '\x1b[33m';
        console.log(`  ${color}${icon}\x1b[0m  ${c.label}: ${c.detail}`);
    }
    console.log('');
}

module.exports = doctorCmd;
