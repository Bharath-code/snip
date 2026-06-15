/**
 * snip packs — list available snippet packs from the community registry.
 *
 * Usage:
 *   snip packs
 */

const packs = require('../packs');
const { log } = require('../quiet');
const { c } = require('../colors');

function packsCmd() {
  const list = packs.BUILTIN_PACKS;

  log('');
  log('  Available snippet packs:');
  log('');
  for (const p of list) {
    const name = c.brand(p.name.padEnd(20));
    const count = c.dim(`(${p.snippetCount} snippets)`);
    log(`    ${name} ${p.description}  ${count}`);
  }
  log('');
  log(c.dim('  Install: snip install <pack-name>'));
  log('');
}

module.exports = packsCmd;
