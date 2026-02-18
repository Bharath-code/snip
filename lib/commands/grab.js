/**
 * snip grab — import a snippet from a URL.
 *
 * Usage:
 *   snip grab https://raw.githubusercontent.com/.../deploy.sh --name deploy --tags deploy,prod
 *   snip grab github:user/repo/scripts/backup.sh --tags backup
 */

const storage = require('../storage');
const path = require('path');

// Map common file extensions to languages
const EXT_LANG = {
    sh: 'sh', bash: 'bash', zsh: 'zsh', fish: 'fish',
    js: 'js', mjs: 'js', cjs: 'js', ts: 'ts', tsx: 'ts',
    py: 'python', rb: 'ruby', php: 'php', pl: 'perl',
    ps1: 'powershell', sql: 'sql', yml: 'yaml', yaml: 'yaml',
    json: 'json', toml: 'toml', md: 'markdown',
};

function resolveUrl(input) {
    // github:user/repo/path shorthand
    const ghMatch = input.match(/^github:([^/]+)\/([^/]+)\/(.+)$/);
    if (ghMatch) {
        const [, user, repo, filepath] = ghMatch;
        return `https://raw.githubusercontent.com/${user}/${repo}/HEAD/${filepath}`;
    }
    return input;
}

function detectLanguage(url, content) {
    // From URL extension
    const ext = path.extname(url.split('?')[0]).replace('.', '').toLowerCase();
    if (EXT_LANG[ext]) return EXT_LANG[ext];

    // From shebang
    const firstLine = (content || '').split('\n')[0] || '';
    if (firstLine.startsWith('#!')) {
        if (firstLine.includes('python')) return 'python';
        if (firstLine.includes('node')) return 'js';
        if (firstLine.includes('ruby')) return 'ruby';
        if (firstLine.includes('bash')) return 'bash';
        if (firstLine.includes('zsh')) return 'zsh';
        if (firstLine.includes('sh')) return 'sh';
    }
    return '';
}

function deriveName(url) {
    const segments = url.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'grabbed';
    // Strip extension and clean
    return last.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

async function grab(url, opts) {
    if (!url) {
        console.error('Usage: snip grab <url|github:user/repo/path> [--name <name>] [--tags <tags>] [--lang <lang>]');
        return;
    }

    const resolved = resolveUrl(url);
    console.log(`Fetching ${resolved}...`);

    let content;
    try {
        const res = await fetch(resolved);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        content = await res.text();
    } catch (e) {
        console.error(`Failed to fetch: ${e.message}`);
        process.exitCode = 1;
        return;
    }

    if (!content || !content.trim()) {
        console.error('Empty response.');
        process.exitCode = 1;
        return;
    }

    const name = opts.name || deriveName(resolved);
    const language = opts.lang || detectLanguage(resolved, content);
    const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const snippet = storage.addSnippet({ name, content: content.trim(), language, tags });
    console.log(`Grabbed "${snippet.name}" (${language || 'unknown'}) — ${content.length} bytes`);
}

module.exports = grab;
