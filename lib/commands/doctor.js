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
    const out = [];
    const snippets = storage.listSnippets();
    const backend = cfg.useSqlite ? 'SQLite' : 'JSON';
    const dbFile = cfg.useSqlite ? cfg.sqlitePath : cfg.dbPath;
    const dbExists = fs.existsSync(dbFile);

    // 1. Storage (and better-sqlite3 when SQLite enabled)
    let storageOk = dbExists;
    let storageDetail = dbExists ? `${backend} (${snippets.length} snippets)` : `${backend} — DB file missing: ${dbFile}`;
    if (cfg.useSqlite) {
        try {
            require('better-sqlite3');
        } catch (_) {
            storageOk = false;
            storageDetail = 'SQLite enabled but better-sqlite3 not installed. Run: npm install -g better-sqlite3';
        }
    }
    out.push({ label: 'Storage', ok: storageOk, detail: storageDetail });

    // 2. Editor
    const editorBin = (cfg.editor || 'vi').split(' ')[0];
    const editorCheck = spawnSync('which', [editorBin], { encoding: 'utf8' });
    out.push({
        label: 'Editor',
        ok: editorCheck.status === 0,
        detail: editorCheck.status === 0 ? cfg.editor : `${cfg.editor} — not found in PATH`
    });

    // 3. Shell
    out.push({ label: 'Shell', ok: true, detail: cfg.defaultShell || process.env.SHELL || 'sh' });

    // 4. fzf (optional)
    const fzfCheck = spawnSync('which', ['fzf'], { encoding: 'utf8' });
    out.push({
        label: 'fzf',
        ok: fzfCheck.status === 0,
        detail: fzfCheck.status === 0 ? 'installed' : 'not installed (optional — `snip fzf` needs it)'
    });

    // 5. Gist sync
    const hasToken = !!(cfg.gist_token || process.env.SNIP_GIST_TOKEN);
    out.push({
        label: 'Gist sync',
        ok: hasToken,
        detail: hasToken ? 'configured' : 'not configured (set SNIP_GIST_TOKEN or snip config set gist_token)'
    });

    // 6. Completions
    const shellName = (process.env.SHELL || '').toLowerCase();
    let completionHint = 'run: eval "$(snip completion)"';
    if (shellName.includes('fish')) completionHint = 'run: snip completion fish | source';
    out.push({ label: 'Completions', ok: null, detail: completionHint });

    // 7. Widget (Ctrl+G)
    const widgetHint = shellName.includes('fish') ? 'snip widget fish | source' : `eval "$(snip widget ${shellName.includes('zsh') ? 'zsh' : 'bash'})"`;
    out.push({ label: 'Widget (Ctrl+G)', ok: null, detail: `Add to your shell rc: ${widgetHint}` });

    // 8. Tip: grab from GitHub
    out.push({ label: 'Grab from GitHub', ok: null, detail: 'snip grab github:user/repo/path/to/file' });

    // Output
    console.log('\n  snip doctor\n');
    for (const c of out) {
        const icon = c.ok === true ? '✓' : c.ok === false ? '✗' : '?';
        const color = c.ok === true ? '\x1b[32m' : c.ok === false ? '\x1b[31m' : '\x1b[33m';
        console.log(`  ${color}${icon}\x1b[0m  ${c.label}: ${c.detail}`);
    }
    console.log('');
}

module.exports = doctorCmd;
