/**
 * snip install — install a snippet pack from the community registry.
 *
 * Usage:
 *   snip install docker-essentials
 *   snip install git-workflow
 *
 * Packs are JSON manifests hosted at github.com/snip-packs/<name>.
 */

const packs = require('../packs');
const { log } = require('../quiet');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');

async function installCmd(name) {
  if (!name) {
    console.error(c.err('  ✗ Pack name required'));
    console.log(c.dim('  Usage: snip install <pack-name>'));
    console.log(c.dim('  Run: snip packs to list available packs'));
    setExitCode(2);
    return;
  }

  log(`  Fetching pack "${name}"...`);

  let result;
  try {
    result = await packs.install(name);
  } catch (e) {
    console.error(c.err(`  ✗ ${e.message}`));
    setExitCode(1);
    return;
  }

  log('');
  log(`  ✅ Installed pack: ${c.brand(result.name)} ${c.dim('v' + result.version)}`);
  if (result.description) {
    log(`     ${c.muted(result.description)}`);
  }
  log('');
  log(`     ${c.brand(String(result.imported))} snippet${result.imported !== 1 ? 's' : ''} added`);
  if (result.skipped > 0) {
    log(`     ${c.err(String(result.skipped))} skipped`);
  }
  log('');
}

module.exports = installCmd;
