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
const { actionHint, stripAnsi } = require('../format');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');

async function execCmd(idOrName, opts = {}) {
    const snippet = storage.getSnippetByIdOrName(idOrName);
    if (!snippet) {
        log('');
        console.error(c.err('  ✗ Snippet not found: ') + c.brand('"' + idOrName + '"'));
        log('');
        
        const suggestions = search.suggestSimilar(idOrName, 3);
        if (suggestions.length) {
            log(c.muted('  Did you mean?'));
            suggestions.forEach((suggestion, i) => {
                log(c.muted('    ') + (i === 0 ? c.brand('→ ') : '  ') + c.brand(suggestion));
            });
            log('');
        }
        
        log(actionHint([
            'snip list:See all',
            'snip search <query>:Find',
        ]));
        
        setExitCode(1);
        return;
    }

    let content = storage.readSnippetContent(snippet);
    if (!content || !content.trim()) {
        log('');
        console.error(c.err('  ✗ Snippet "' + snippet.name + '" is empty.'));
        log('');
        
        setExitCode(1);
        return;
    }

    // Template interpolation
    if (template.hasVariables(content)) {
        content = await template.promptAndInterpolate(content);
    }

    const cfg = config.loadConfig();

    // Safety check — exec skips the TUI modal but still warns on dangerous snippets
    if (!opts.force && safety.isDangerous(content)) {
        log('');
        console.error(c.warn('  ⚠️  Dangerous command detected'));
        console.error(c.dim('  ') + content.split('\n')[0]);
        log('');
        const answer = await question(c.dim('  Run anyway? ') + c.brand('[y/N]') + c.dim(': '));
        if (answer.toLowerCase() !== 'y') {
            log(c.muted('  Aborted.'));
            setExitCode(1);
            return;
        }
    }

    if (opts.dryRun) {
        log('');
        log(c.dim('  ─── ') + c.brand('Dry run: ') + snippet.name + c.dim(' ───'));
        log('');
        console.log(content);  // content is data output
        log('');
        return;
    }

    // ── Running status with boxed output ──
    const cols = Math.min(process.stdout.columns || 80, 72);
    
    log('');
    log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));
    const execStr = ' ' + c.brand(icons.run + ' Executing: ') + c.brand(snippet.name);
    const execPadding = Math.max(0, cols - 2 - stripAnsi(execStr).length - 1);
    log(c.border('  │') + execStr + ' '.repeat(execPadding) + c.border('│'));
    
    const cmdStr = ' ' + c.code(content.split('\n')[0] || '');
    const cmdPadding = Math.max(0, cols - 2 - stripAnsi(cmdStr).length - 1);
    log(c.border('  │') + cmdStr + ' '.repeat(cmdPadding) + c.border('│'));
    log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));
    log('');
    
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
      log(c.success('  ' + icons.check + ' Completed in ' + elapsed + 's'));
    } else {
      log(c.err('  ' + icons.cross + ' Failed with exit code: ') + status);
    }
    
    setExitCode(status || 0);
}

module.exports = execCmd;
