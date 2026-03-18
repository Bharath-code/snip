/**
 * snip exec — zero-friction snippet execution.
 * Runs immediately without the TUI preview modal.
 *
 * Usage:
 *   snip exec deploy-api
 *   snip exec deploy-api --dry-run
 */

const storage = require('../storage');
const config = require('../config');
const exec = require('../exec');
const safety = require('../safety');
const template = require('../template');
const { question } = require('../readline');
const search = require('../search');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint } = require('../format');

async function execCmd(idOrName, opts = {}) {
    const snippet = storage.getSnippetByIdOrName(idOrName);
    if (!snippet) {
        // Enhanced error message
        console.log('');
        console.log(c.err('  ✗ Snippet not found: ') + c.brand('"' + idOrName + '"'));
        console.log('');
        
        const suggestions = search.suggestSimilar(idOrName, 3);
        if (suggestions.length) {
            console.log(c.muted('  Did you mean?'));
            suggestions.forEach((suggestion, i) => {
                console.log(c.muted('    ') + (i === 0 ? c.brand('→ ') : '  ') + c.brand(suggestion));
            });
            console.log('');
        }
        
        console.log(actionHint([
            'snip list:See all',
            'snip search <query>:Find',
        ]));
        
        process.exitCode = 1;
        return;
    }

    let content = storage.readSnippetContent(snippet);
    if (!content || !content.trim()) {
        console.log('');
        console.log(c.err('  ✗ Snippet "' + snippet.name + '" is empty.'));
        console.log('');
        
        process.exitCode = 1;
        return;
    }

    // Template interpolation
    if (template.hasVariables(content)) {
        content = await template.promptAndInterpolate(content);
    }

    const cfg = config.loadConfig();

    // Safety check — exec skips the TUI modal but still warns on dangerous snippets
    if (!opts.force && safety.isDangerous(content)) {
        console.log('');
        console.log(c.warn('  ⚠️  Dangerous command detected'));
        console.log(c.dim('  ') + content.split('\n')[0]);
        console.log('');
        const answer = await question(c.dim('  Run anyway? ') + c.brand('[y/N]') + c.dim(': '));
        if (answer.toLowerCase() !== 'y') {
            console.log(c.muted('  Aborted.'));
            return;
        }
    }

    if (opts.dryRun) {
        console.log('');
        console.log(c.dim('  ─── ') + c.brand('Dry run: ') + snippet.name + c.dim(' ───'));
        console.log('');
        console.log(content);
        console.log('');
        return;
    }

    // Show running status
    console.log('');
    console.log(c.brand('  ' + icons.run + ' Executing: ') + c.brand(snippet.name));
    console.log(c.dim('  ') + content.split('\n')[0]);
    console.log('');
    
    const startTime = Date.now();
    const status = exec.runSnippetContent(content, {
        dryRun: false,
        shell: cfg.defaultShell,
        language: snippet.language
    });

    if (status === 0) {
      storage.touchUsage(snippet);
      require('./last').setLastRun(snippet.id);
      require('../streak').recordUsage();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(c.success('  ✓ Completed in ') + elapsed + 's');
    } else {
      console.log(c.err('  ✗ Failed with exit code: ') + status);
    }
    
    process.exitCode = status || 0;
}

module.exports = execCmd;
