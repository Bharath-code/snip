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
        console.log('');
        console.log(c.brand('  ' + icons.fire + ' snip streak'));
        console.log('');
        console.log(c.dim('  ') + c.brand(String(streakDays)) + c.muted(' day' + (streakDays === 1 ? '' : 's') + ' in a row'));
        if (lastDate) console.log(c.dim('  Last used: ' + lastDate));
        console.log('');
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

    // Enhanced colored terminal output with Claude Code-inspired design
    console.log('');
    console.log(c.brand('  ' + icons.chart + ' Your snip Statistics'));
    console.log(c.dim('  ' + '─'.repeat(40)));
    console.log('');

    // Stats cards
    const stats = [
        { label: 'Snippets', value: all.length, icon: icons.list },
        { label: 'Total Runs', value: totalUsage, icon: icons.run },
        { label: 'Day Streak', value: streak.getStreak().streak, icon: icons.fire },
    ];

    // Print stats in a row
    const cardWidth = 20;
    let row = '';
    stats.forEach((stat, i) => {
        const val = String(stat.value);
        const card = c.dim('  ') + stat.icon + ' ' + 
            c.brand(val.padStart(6)) + c.muted(' ' + stat.label);
        row += card + '    ';
    });
    console.log(row);
    console.log('');

    // Languages section
    if (languages.length) {
        console.log(c.dim('  ') + c.brand(icons.language + ' Language Distribution'));
        console.log(c.dim('  ' + '─'.repeat(30)));
        console.log('');
        
        const maxLangCount = Math.max(...languages.map(([, count]) => count));
        const barWidth = 20;
        
        languages.slice(0, 6).forEach(([lang, count]) => {
            const langIcon = icons.getLangIcon(lang);
            const ratio = count / maxLangCount;
            const filled = Math.round(ratio * barWidth);
            const bar = c.brand('█'.repeat(filled)) + c.dim('░'.repeat(barWidth - filled));
            const percent = Math.round((count / all.length) * 100);
            console.log(c.dim('  ') + 
                c.code(langIcon + ' ' + lang.padEnd(10)) + ' ' + 
                bar + ' ' + 
                c.muted(String(count).padStart(3) + ' (' + percent + '%)'));
        });
        console.log('');
    }

    // Tags section
    if (topTags.length) {
        console.log(c.dim('  ') + c.brand(icons.tag + ' Top Tags'));
        console.log(c.dim('  ' + '─'.repeat(30)));
        console.log('');
        
        const tagBar = topTags.slice(0, 5).map(([tag, count]) => {
            return c.tag('  ' + icons.tag + ' ' + tag) + c.muted(' (' + count + ')');
        }).join(c.dim('  ·'));
        
        console.log(tagBar);
        console.log('');
    }

    // Most used
    if (mostUsed && mostUsed.usageCount) {
        console.log(c.dim('  ') + c.brand(icons.star + ' Most Used: ') + 
            c.brand(mostUsed.name) + 
            c.muted(' (' + mostUsed.usageCount + ' runs)'));
        console.log('');
    }
}

module.exports = statsCmd;
