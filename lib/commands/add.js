const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const storage = require('../storage');
const config = require('../config');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function add(name, opts) {
  const cfg = config.loadConfig();
  let content = '';
  if (!process.stdin.isTTY) {
    content = await readStdin();
  } else {
    const tmp = path.join(os.tmpdir(), `snip-${Date.now()}.tmp`);
    fs.writeFileSync(tmp, `# Snippet: ${name}\n\n`);
    const editor = cfg.editor.split(' ');
    spawnSync(editor[0], editor.slice(1).concat([tmp]), { stdio: 'inherit' });
    content = fs.readFileSync(tmp, 'utf8');
    fs.unlinkSync(tmp);
  }
  const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()) : [];
  const snippet = storage.addSnippet({ name, content, language: opts.lang, tags });
  console.log(`Added snippet ${snippet.name} (${snippet.id})`);
}

module.exports = add;
