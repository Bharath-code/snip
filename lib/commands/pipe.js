/**
 * snip pipe — pipeline-friendly snippet execution.
 *
 * Zero chrome. Pure stdout. Composable with unix pipes.
 *
 * Usage:
 *   snip pipe deploy-api                          # run, output to stdout
 *   snip pipe deploy-api --dry-run                # print resolved content
 *   echo '{"host":"prod"}' | snip pipe deploy --json   # stdin JSON → template vars
 *   curl -s api.com | snip pipe parse-json        # stdin passthrough to snippet
 */

const storage = require('../storage');
const config = require('../config');
const exec = require('../exec');
const template = require('../template');

function readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
            resolve(null);
            return;
        }
        const chunks = [];
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(chunks.join('')));
        process.stdin.on('error', () => resolve(null));
    });
}

async function pipeCmd(idOrName, opts = {}) {
    const snippet = storage.getSnippetByIdOrName(idOrName);
    if (!snippet) {
        process.stderr.write(`Snippet not found: "${idOrName}"\n`);
        process.exitCode = 1;
        return;
    }

    let content = storage.readSnippetContent(snippet);
    if (!content || !content.trim()) {
        process.stderr.write(`Snippet "${snippet.name}" is empty.\n`);
        process.exitCode = 1;
        return;
    }

    const stdinData = await readStdin();

    // --json mode: parse stdin as JSON, interpolate template variables
    if (opts.json && stdinData) {
        let values;
        try {
            values = JSON.parse(stdinData);
        } catch (e) {
            process.stderr.write(`Invalid JSON on stdin: ${e.message}\n`);
            process.exitCode = 1;
            return;
        }
        content = template.interpolate(content, values);
    }

    // Dry run: print resolved content to stdout, done
    if (opts.dryRun) {
        process.stdout.write(content);
        return;
    }

    const cfg = config.loadConfig();

    // Execute — stdin passthrough when we have non-JSON stdin data
    const runOpts = {
        dryRun: false,
        shell: cfg.defaultShell,
        language: snippet.language,
    };

    // If stdin data exists but not --json, pass it through to the child process
    if (stdinData && !opts.json) {
        runOpts.stdinData = stdinData;
    }

    const status = exec.runSnippetContent(content, runOpts);
    if (status === 0) storage.touchUsage(snippet);
    process.exitCode = status || 0;
}

module.exports = pipeCmd;
