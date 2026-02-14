const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function runSnippetContent(content, opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-'));
  const file = path.join(tmpDir, 'snippet.sh');
  fs.writeFileSync(file, content, { mode: 0o700 });
  if (opts.dryRun) {
    console.log('--- DRY RUN ---');
    console.log(content);
    return 0;
  }
  const shell = opts.shell || process.env.SHELL || 'sh';
  const res = spawnSync(shell, [file], { stdio: 'inherit' });
  return res.status || 0;
}

module.exports = { runSnippetContent };
