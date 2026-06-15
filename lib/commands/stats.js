/**
 * snip stats — library statistics.
 *
 * Usage:
 *   snip stats           # colored terminal output
 *   snip stats --json    # machine-readable JSON
 *   snip stats --streak  # days in a row using snip
 */

const storage = require('../storage');
const { c } = require('../colors');
const icons = require('../icons');
const streak = require('../streak');
const { stripAnsi } = require('../format');
const { log } = require('../quiet');

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

    // --streak: show streak only
    if (opts.streak) {
        const { streak: streakDays, lastDate } = streak.getStreak();
        if (opts.json) {
            console.log(JSON.stringify({ streak: streakDays, lastDate }, null, 2));
            return;
        }
        log('');
        log(c.brand('  ' + icons.fire + ' snip streak'));
        log('');
        log(c.dim('  ') + c.brand(String(streakDays)) + c.muted(' day' + (streakDays === 1 ? '' : 's') + ' in a row'));
        if (lastDate) log(c.dim('  Last used: ' + lastDate));
        log('');
        return;
    }

    // --json: machine-readable output
    if (opts.json) {
        const out = {
            total: all.length,
            totalRuns: totalUsage,
            mostUsed: mostUsed && mostUsed.usageCount ? { name: mostUsed.name, runs: mostUsed.usageCount } : null,
            languages: Object.fromEntries(languages),
            topTags: Object.fromEntries(topTags),
        };
        out.streak = streak.getStreak().streak;
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    // ── Claude Code-inspired stats dashboard ──
    const cols = Math.min(process.stdout.columns || 80, 72);
    const boxWidth = cols;
    
    log('');
    
    // Top border
    log(c.border('  ┌' + '─'.repeat(boxWidth - 2) + '┐'));
    const titleStr = ' ' + c.brand(icons.chart + ' Your snip Statistics');
    const titlePadding = Math.max(0, boxWidth - 2 - stripAnsi(titleStr).length - 1);
    log(c.border('  │') + titleStr + ' '.repeat(titlePadding) + c.border('│'));
    
    // Stat cards in a row
    const stats = [
        { label: 'Snippets', value: all.length, icon: icons.list },
        { label: 'Total Runs', value: totalUsage, icon: icons.run },
        { label: 'Day Streak', value: streak.getStreak().streak, icon: icons.fire },
    ];
    
    // Build stat row
    const statParts = stats.map(s => {
        const val = String(s.value).padStart(5);
        return s.icon + ' ' + c.brand(val) + c.muted(' ' + s.label);
    });
    const statStr = '  ' + statParts.join(c.muted('  │  '));
    const statPadding = Math.max(0, boxWidth - 2 - stripAnsi(statStr).length - 1);
    log(c.border('  │') + statStr + ' '.repeat(statPadding) + c.border('│'));

    // Languages section
    if (languages.length) {
        log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
        
        const langTitle = ' ' + c.brand(icons.language + ' Language Distribution');
        const langTitlePadding = Math.max(0, boxWidth - 2 - stripAnsi(langTitle).length - 1);
        log(c.border('  │') + langTitle + ' '.repeat(langTitlePadding) + c.border('│'));
        
        const maxLangCount = Math.max(...languages.map(([, count]) => count));
        const barWidth = 18;
        
        languages.slice(0, 6).forEach(([lang, count]) => {
            const langIcon = icons.getLangIcon(lang);
            const ratio = count / maxLangCount;
            const filled = Math.round(ratio * barWidth);
            const bar = c.brand('█'.repeat(filled)) + c.dim('░'.repeat(barWidth - filled));
            const percent = Math.round((count / all.length) * 100);
            const langStr = '  ' + c.code(langIcon + ' ' + lang.padEnd(8)) + ' ' + bar + ' ' + c.muted(String(count).padStart(3) + ' (' + percent + '%)');
            const langPadding = Math.max(0, boxWidth - 2 - stripAnsi(langStr).length - 1);
            console.log(c.border('  │') + langStr + ' '.repeat(langPadding) + c.border('│'));
        });
    }

    // Tags section
    if (topTags.length) {
        log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
        
        const tagTitle = ' ' + c.brand(icons.tag + ' Top Tags');
        const tagTitlePadding = Math.max(0, boxWidth - 2 - stripAnsi(tagTitle).length - 1);
        log(c.border('  │') + tagTitle + ' '.repeat(tagTitlePadding) + c.border('│'));
        
        const tagStr = '  ' + topTags.slice(0, 5).map(([tag, count]) => {
            return c.tag(icons.tag + ' ' + tag) + c.muted(' (' + count + ')');
        }).join(c.dim('  ·  '));
        const tagPadding = Math.max(0, boxWidth - 2 - stripAnsi(tagStr).length - 1);
        log(c.border('  │') + tagStr + ' '.repeat(tagPadding) + c.border('│'));
    }

    // Most used
    if (mostUsed && mostUsed.usageCount) {
        log(c.border('  ├' + '─'.repeat(boxWidth - 2) + '┤'));
        const mostStr = ' ' + c.brand(icons.star + ' Most Used: ') + c.brand(mostUsed.name) + c.muted(' (' + mostUsed.usageCount + ' runs)');
        const mostPadding = Math.max(0, boxWidth - 2 - stripAnsi(mostStr).length - 1);
        log(c.border('  │') + mostStr + ' '.repeat(mostPadding) + c.border('│'));
    }
    
    // Bottom border
    log(c.border('  └' + '─'.repeat(boxWidth - 2) + '┘'));
    log('');
}

module.exports = statsCmd;
