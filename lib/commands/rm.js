const storage = require('../storage');
const { c } = require('../colors');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');
const readline = require('readline');

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function remove(idOrName, opts = {}) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) {
    console.error(c.err(`Error: "${idOrName}" not found`));
    console.error(c.dim(`  Run`) + c.dim(` snip list`) + c.dim(` to see all snippets`));
    setExitCode(1);
    return;
  }

  // UX: Show preview before delete
  log(c.dim('  Will delete:'));
  log(c.accent(`    Name:    ${s.name}`));
  log(c.dim(`    Language: ${s.language || '(none)'}`));
  log(c.dim(`    Tags:    ${(s.tags || []).join(', ') || '(none)'}`));

  // UX: Confirm unless --force is passed
  if (opts.force || process.stdin.isTTY === false) {
    storage.deleteSnippetById(s.id);
    log(c.success('✓') + c.dim(' Deleted: ') + c.accent(s.name));
    return;
  }

  const answer = await confirm(c.dim('  Delete this snippet? [y/N] '));
  if (!answer) {
    log(c.dim('  Cancelled.'));
    return;
  }

  storage.deleteSnippetById(s.id);
  log(c.success('✓') + c.dim(' Deleted: ') + c.accent(s.name));
}

module.exports = remove;
