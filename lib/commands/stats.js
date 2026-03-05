/**
 * snip stats — library statistics.
 *
 * Usage:
 *   snip stats           # colored terminal output
 *   snip stats --json    # machine-readable JSON
 */

const storage = require('../storage');

// Brand-consistent colors (graceful fallback)
let chalk = null;
try {
    const m = require('chalk');
    chalk = (m && m.default) ? m.default : m;
} catch (_) { }
const c = {
    accent: (t) => chalk ? chalk.hex('#ff4d00').bold(t) : t,
    val: (t) => chalk ? chalk.hex('#ff7a33')(t) : t,
    tag: (t) => chalk ? chalk.hex('#F5A623')(t) : t,
    muted: (t) => chalk ? chalk.hex('#6C7086')(t) : t,
    dim: (t) => chalk ? chalk.dim(t) : t,
};

function statsCmd(opts = {}) {
    const all = storage.listSnippets();
    const langMap = {};
    const tagMap = {};
    let totalUsage = 0;
    let mostUsed = null;
    let leastUsed = null;

    for (const s of all) {
        const lang = s.language || 'unknown';
        langMap[lang] = (langMap[lang] || 0) + 1;
        totalUsage += s.usageCount || 0;

        for (const tag of (s.tags || [])) {
            tagMap[tag] = (tagMap[tag] || 0) + 1;
        }

        if (!mostUsed || (s.usageCount || 0) > (mostUsed.usageCount || 0)) mostUsed = s;
        if (!leastUsed || (s.usageCount || 0) < (leastUsed.usageCount || 0)) leastUsed = s;
    }

    const languages = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
    const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // --json: machine-readable output
    if (opts.json) {
        console.log(JSON.stringify({
            total: all.length,
            totalRuns: totalUsage,
            mostUsed: mostUsed && mostUsed.usageCount ? { name: mostUsed.name, runs: mostUsed.usageCount } : null,
            languages: Object.fromEntries(languages),
            topTags: Object.fromEntries(topTags),
        }, null, 2));
        return;
    }

    // Colored terminal output
    console.log('');
    console.log(c.accent('  ─── snip stats ───'));
    console.log('');
    console.log(`  Snippets     ${c.val(all.length)}`);
    console.log(`  Total runs   ${c.val(totalUsage)}`);

    if (mostUsed && mostUsed.usageCount) {
        console.log(`  Most used    ${c.val(mostUsed.name)} ${c.muted(`(${mostUsed.usageCount} runs)`)}`);
    }

    if (languages.length) {
        console.log('');
        console.log(c.dim('  Languages'));
        for (const [lang, count] of languages) {
            const bar = '█'.repeat(Math.max(1, Math.round((count / all.length) * 20)));
            console.log(`  ${c.val(lang.padEnd(14))} ${c.accent(bar)} ${c.muted(count)}`);
        }
    }

    if (topTags.length) {
        console.log('');
        console.log(c.dim('  Top tags'));
        console.log(`  ${topTags.map(([t, n]) => c.tag(`${t}(${n})`)).join('  ')}`);
    }

    console.log('');
}

module.exports = statsCmd;
