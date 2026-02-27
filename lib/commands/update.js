const storage = require('../storage');

function update(idOrName, opts) {
    const s = storage.getSnippetByIdOrName(idOrName);
    if (!s) {
        console.error(`Snippet not found: "${idOrName}"`);
        process.exitCode = 1;
        return;
    }

    const meta = {};
    if (opts.tags) {
        meta.tags = opts.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (opts.lang) {
        meta.language = opts.lang;
    }

    if (!Object.keys(meta).length) {
        console.error('Nothing to update. Use --tags and/or --lang.');
        return;
    }

    storage.updateSnippetMeta(s.id, meta);
    const parts = [];
    if (meta.tags) parts.push(`tags → ${meta.tags.join(', ')}`);
    if (meta.language) parts.push(`lang → ${meta.language}`);
    console.log(`Updated "${s.name}": ${parts.join(', ')}`);
}

module.exports = update;
