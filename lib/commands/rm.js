const storage = require('../storage');
const { c } = require('../colors');
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
    process.exitCode = 1;
    return;
  }

  // UX: Show preview before delete
  console.log(c.dim('  Will delete:'));
  console.log(c.accent(`    Name:    ${s.name}`));
  console.log(c.dim(`    Language: ${s.language || '(none)'}`));
  console.log(c.dim(`    Tags:    ${(s.tags || []).join(', ') || '(none)'}`));

  // UX: Confirm unless --force is passed
  if (opts.force || process.stdin.isTTY === false) {
    storage.deleteSnippetById(s.id);
    console.log(c.success('✓') + c.dim(' Deleted: ') + c.accent(s.name));
    return;
  }

  const answer = await confirm(c.dim('  Delete this snippet? [y/N] '));
  if (!answer) {
    console.log(c.dim('  Cancelled.'));
    return;
  }

  storage.deleteSnippetById(s.id);
  console.log(c.success('✓') + c.dim(' Deleted: ') + c.accent(s.name));
}

module.exports = remove;
