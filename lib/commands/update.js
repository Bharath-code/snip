const storage = require('../storage');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');
const icons = require('../icons');

function update(idOrName, opts) {
    const s = storage.getSnippetByIdOrName(idOrName);
    if (!s) {
        console.error(c.err(`  ${icons.cross} Snippet not found: `) + c.brand(`"${idOrName}"`));
        setExitCode(1);
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
        console.error(c.err(`  ${icons.cross} Nothing to update. Use --tags and/or --lang.`));
        setExitCode(1);
        return;
    }

    storage.updateSnippetMeta(s.id, meta);
    const parts = [];
    if (meta.tags) parts.push(`tags → ${meta.tags.join(', ')}`);
    if (meta.language) parts.push(`lang → ${meta.language}`);
    log(`Updated "${s.name}": ${parts.join(', ')}`);
}

module.exports = update;
