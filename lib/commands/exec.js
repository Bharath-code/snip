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

function execCmd(idOrName, opts = {}) {
    const snippet = storage.getSnippetByIdOrName(idOrName);
    if (!snippet) {
        console.error(`Snippet not found: "${idOrName}"`);
        process.exitCode = 1;
        return;
    }

    let content = storage.readSnippetContent(snippet);
    if (!content || !content.trim()) {
        console.error(`Snippet "${snippet.name}" is empty.`);
        process.exitCode = 1;
        return;
    }

    // Template interpolation
    if (template.hasVariables(content)) {
        content = template.promptAndInterpolate(content);
    }

    const cfg = config.loadConfig();

    // Safety check — exec skips the TUI modal but still warns on dangerous snippets
    if (!opts.force && safety.isDangerous(content)) {
        const rl = require('readline-sync');
        const answer = rl.question(`⚠ Dangerous command detected. Run anyway? (y/N) `);
        if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            return;
        }
    }

    if (opts.dryRun) {
        console.log(content);
        return;
    }

    const status = exec.runSnippetContent(content, {
        dryRun: false,
        shell: cfg.defaultShell,
        language: snippet.language
    });

    if (status === 0) storage.touchUsage(snippet);
    process.exitCode = status || 0;
}

module.exports = execCmd;
