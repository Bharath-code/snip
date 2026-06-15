/**
 * snip discover — search public Gists shared by the community.
 *
 * Usage:
 *   snip discover "docker health check"          # Search public gists
 *   snip discover "deploy" --lang python          # Filter by language
 *   snip discover --recent                        # Browse recent public gists
 *   snip discover --recent --snip-only            # Only show gists with "snip:" description
 *   snip discover "deploy" --json                 # JSON output
 */

const gist = require('../sync/gist');
const { c } = require('../colors');
const { log } = require('../quiet');
const { stripAnsi } = require('../format');
const { setExitCode } = require('../cli-utils');
const { getGistToken } = require('../command-utils');

/**
 * Format a gist result as a card for display
 */
function formatGistCard(gist, index) {
  const cols = Math.min(process.stdout.columns || 80, 72);
  const boxWidth = Math.min(cols, 72);

  let result = '';

  // Card top border
  result += c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐') + '\n';

  // Header line with index and description
  const idx = c.dim(String(index + 1).padStart(2));
  const desc = gist.description || '(no description)';
  const headerStr = `${idx}  ${c.brand(desc)}`;
  const headerPadding = Math.max(0, boxWidth - 2 - stripAnsi(headerStr).length - 1);
  result += c.border('  │') + ' ' + headerStr + ' '.repeat(headerPadding) + c.border('│') + '\n';

  // File names line
  const fileNames = gist.files ? Object.keys(gist.files) : [];
  const fileStr = fileNames.length
    ? c.muted('    files: ' + fileNames.join(', '))
    : c.muted('    (no files)');
  const filePadding = Math.max(0, boxWidth - 2 - stripAnsi(fileStr).length - 1);
  result += c.border('  │') + fileStr + ' '.repeat(filePadding) + c.border('│') + '\n';

  // URL line
  const url = gist.html_url || `https://gist.github.com/${gist.id}`;
  const urlStr = c.dim('    ' + url);
  const urlPadding = Math.max(0, boxWidth - 2 - stripAnsi(urlStr).length - 1);
  result += c.border('  │') + urlStr + ' '.repeat(urlPadding) + c.border('│') + '\n';

  // Owner line
  const owner = gist.owner ? gist.owner.login : 'anonymous';
  const created = gist.created_at ? new Date(gist.created_at).toLocaleDateString() : '';
  const metaStr = c.dim(`    by ${owner}${created ? ' · ' + created : ''}`);
  const metaPadding = Math.max(0, boxWidth - 2 - stripAnsi(metaStr).length - 1);
  result += c.border('  │') + metaStr + ' '.repeat(metaPadding) + c.border('│') + '\n';

  // Card bottom border
  result += c.border('  └' + '─'.repeat(boxWidth - 2) + '┘');

  return result;
}

async function discoverCmd(query, opts = {}) {
  const { token } = getGistToken({ required: false });

  if (opts.recent) {
    // ── Browse recent public gists ──
    try {
      const gists = await gist.listRecentGists(token, { limit: opts.limit || 30 });

      if (!gists || gists.length === 0) {
        log(c.dim('  No public gists found.'));
        setExitCode(1);
        return;
      }

      // Filter to "snip:" descriptions if --snip-only
      let filtered = gists;
      if (opts.snipOnly) {
        filtered = gists.filter(g => g.description && g.description.toLowerCase().startsWith('snip:'));
        if (filtered.length === 0) {
          log(c.dim('  No snip-shared gists found in recents.'));
          log(c.muted('  Try without --snip-only to see all recent public gists.'));
          setExitCode(1);
          return;
        }
      }

      if (opts.json) {
        const out = filtered.map(g => ({
          id: g.id,
          description: g.description || '',
          url: g.html_url || `https://gist.github.com/${g.id}`,
          files: g.files ? Object.keys(g.files) : [],
          owner: g.owner ? g.owner.login : 'anonymous',
          created: g.created_at,
        }));
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      log('');
      if (opts.snipOnly) {
        log(c.brand('  Recent snip-shared Gists') + c.dim(' — ' + filtered.length + ' found'));
      } else {
        log(c.brand('  Recent Public Gists') + c.dim(' — ' + filtered.length + ' shown'));
      }
      log('');

      filtered.forEach((g, i) => {
        log(formatGistCard(g, i));
        log('');
      });

      log(c.dim('  Import with: ') + c.code('snip sync pull <gist-id>'));
      log('');

    } catch (e) {
      console.error(c.err(`  ✗ Failed to list gists: ${e.message}`));
      setExitCode(1);
    }
    return;
  }

  // ── Search gists by query ──
  if (!query) {
    console.error(c.err('  ✗ Search query is required'));
    console.log(c.dim('  Usage: snip discover <query> [--lang <lang>]'));
    console.log(c.dim('       snip discover --recent'));
    setExitCode(2);
    return;
  }

  if (!token) {
    console.error(c.err('  ✗ GitHub token not configured. Set SNIP_GIST_TOKEN env var or run: snip config set gist_token <your-token>'));
    console.log(c.muted('  Note: --recent mode works without a token.'));
    setExitCode(1);
    return;
  }

  try {
    const results = await gist.searchCodeGists(query, token, {
      lang: opts.lang,
      limit: opts.limit || 15,
    });

    const items = results.items || [];
    const total = results.total_count || 0;

    if (opts.json) {
      const out = items.map(item => {
        // Extract gist ID from the html_url or url
        const htmlUrl = item.html_url || '';
        // GitHub gist file URLs look like: https://gist.github.com/abc123#file-deploy-sh
        const gistMatch = htmlUrl.match(/gist\.github\.com\/([a-f0-9]+)/);
        const gistId = gistMatch ? gistMatch[1] : '';
        return {
          name: item.name,
          path: item.path,
          gistId,
          url: htmlUrl,
          repository: item.repository ? item.repository.full_name : '',
          score: item.score,
        };
      });
      console.log(JSON.stringify({ total_count: total, items: out }, null, 2));
      return;
    }

    log('');
    if (total === 0) {
      log(c.dim('  No results found for ') + c.brand(`"${query}"`) + c.dim('.'));
      log(c.muted('  Tip: Try broader terms or browse recent gists with: ') + c.code('snip discover --recent'));
      log('');
      return;
    }
    log(c.brand(`  "${query}"`) + c.dim(` — ${total} result${total === 1 ? '' : 's'} found in public gists`));
    if (opts.lang) log(c.muted(`  Language: ${opts.lang}`));
    log('');

    items.forEach((item, i) => {
      const htmlUrl = item.html_url || '';
      const gistMatch = htmlUrl.match(/gist\.github\.com\/([a-f0-9]+)/);
      const gistId = gistMatch ? gistMatch[1] : '';

      const cols = Math.min(process.stdout.columns || 80, 72);
      const boxWidth = Math.min(cols, 72);

      log(c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐'));

      const idx = c.dim(String(i + 1).padStart(2));
      const nameStr = `${idx}  ${c.brand(item.name)}`;
      const namePadding = Math.max(0, boxWidth - 2 - stripAnsi(nameStr).length - 1);
      log(c.border('  │') + ' ' + nameStr + ' '.repeat(namePadding) + c.border('│'));

      const pathStr = c.muted('    ' + item.path);
      const pathPadding = Math.max(0, boxWidth - 2 - stripAnsi(pathStr).length - 1);
      log(c.border('  │') + pathStr + ' '.repeat(pathPadding) + c.border('│'));

      if (htmlUrl) {
        const urlStr = c.dim('    ' + htmlUrl);
        const urlPadding = Math.max(0, boxWidth - 2 - stripAnsi(urlStr).length - 1);
        log(c.border('  │') + urlStr + ' '.repeat(urlPadding) + c.border('│'));
      }

      if (gistId) {
        const importStr = c.dim('    snip sync pull ') + c.code(gistId);
        const importPadding = Math.max(0, boxWidth - 2 - stripAnsi(importStr).length - 1);
        log(c.border('  │') + importStr + ' '.repeat(importPadding) + c.border('│'));
      }

      log(c.border('  └' + '─'.repeat(boxWidth - 2) + '┘'));
      log('');
    });

    log(c.dim('  Import any snippet with: ') + c.code('snip sync pull <gist-id>'));
    log('');

  } catch (e) {
    console.error(c.err(`  ✗ Discover failed: ${e.message}`));
    setExitCode(1);
  }
}

module.exports = discoverCmd;
