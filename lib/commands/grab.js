/**
 * snip grab — import a snippet from a URL.
 *
 * Usage:
 *   snip grab https://raw.githubusercontent.com/.../deploy.sh --name deploy --tags deploy,prod
 *   snip grab github:user/repo/scripts/backup.sh --tags backup
 */

const storage = require('../storage');
// path no longer needed — language detection moved to lib/language-detect.js
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');

const { detectLanguageFromUrl } = require('../language-detect');

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
    return detectLanguageFromUrl(url, content);
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
        setExitCode(2); // misuse: missing URL
        return;
    }

    const resolved = resolveUrl(url);

    // S3: Validate URL scheme — reject file://, data:, etc.
    let parsedUrl;
    try {
        parsedUrl = new URL(resolved);
    } catch (_) {
        console.error(`Invalid URL: ${resolved}`);
        setExitCode(1);
        return;
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.error(`Rejected: only http:// and https:// URLs are allowed (got ${parsedUrl.protocol})`);
        setExitCode(1);
        return;
    }

    log(`Fetching ${resolved}...`);

    // F3: AbortController with 10s timeout
    const MAX_BYTES = 512 * 1024; // S4: 512KB limit
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);

    let content;
    try {
        const res = await fetch(resolved, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        // S4: Check Content-Length header first
        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_BYTES) {
            console.error(`Response too large (${(contentLength / 1024).toFixed(0)}KB). Max is ${MAX_BYTES / 1024}KB.`);
            setExitCode(1);
            return;
        }

        // S4: Stream with byte counter
        const reader = res.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > MAX_BYTES) {
                reader.cancel();
                console.error(`Response exceeded ${MAX_BYTES / 1024}KB limit. Aborting.`);
                setExitCode(1);
                return;
            }
            chunks.push(value);
        }
        content = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') {
            console.error('Request timed out after 10 seconds.');
        } else {
            console.error(`Failed to fetch: ${e.message}`);
        }
        setExitCode(1);
        return;
    }

    if (!content || !content.trim()) {
        console.error('Empty response.');
        setExitCode(1);
        return;
    }

    const name = opts.name || deriveName(resolved);
    const language = opts.lang || detectLanguage(resolved, content);
    const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const snippet = storage.addSnippet({ name, content: content.trim(), language, tags });
    log(`Grabbed "${snippet.name}" (${language || 'unknown'}) — ${content.length} bytes`);
}

module.exports = grab;
