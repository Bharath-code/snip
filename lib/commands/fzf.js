const storage = require('../storage');
const { spawnSync } = require('child_process');

function fzfSearch() {
    // Check if fzf is available
    const check = spawnSync('which', ['fzf'], { encoding: 'utf8' });
    if (check.status !== 0) {
        console.error('fzf is not installed. Install it from https://github.com/junegunn/fzf');
        process.exitCode = 1;
        return;
    }

    const all = storage.listSnippets();
    if (!all.length) {
        console.log('No snippets. Add one with: snip add <name> --lang sh --tags demo');
        return;
    }

    // Build lines for fzf: "name [lang] tag1,tag2"
    const lines = all.map(s => {
        const lang = s.language ? `[${s.language}]` : '';
        const tags = (s.tags || []).join(',');
        return `${s.name}\t${lang}\t${tags}\t${s.id}`;
    });

    const input = lines.join('\n');

    const result = spawnSync('fzf', [
        '--ansi',
        '--delimiter=\t',
        '--with-nth=1,2,3',
        '--preview', 'snip show {4}',
        '--preview-window=right:60%:wrap',
        '--header=↑↓ navigate • enter select • esc quit',
        '--prompt=snip> ',
        '--height=80%',
        '--border=rounded'
    ], {
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'inherit']
    });

    if (result.status !== 0 || !result.stdout) {
        // User pressed Esc or fzf exited
        return;
    }

    const selected = result.stdout.trim();
    const parts = selected.split('\t');
    const id = parts[parts.length - 1];

    if (id) {
        const snippet = storage.getSnippetByIdOrName(id);
        if (snippet) {
            const content = storage.readSnippetContent(snippet);
            console.log(content);
        }
    }
}

module.exports = fzfSearch;
