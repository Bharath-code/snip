const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const storage = require('../storage');
const config = require('../config');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint } = require('../format');

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
  
  // Enhanced success message
  console.log('');
  console.log(c.success('  ✓ Created: ') + c.brand(snippet.name));
  console.log('');
  
  // Show snippet details
  const langIcon = icons.getLangIcon(snippet.language);
  const metaParts = [];
  if (snippet.language) metaParts.push(c.code(langIcon + ' ' + snippet.language));
  if (snippet.tags && snippet.tags.length) metaParts.push(c.tag(icons.tag + ' ' + snippet.tags.join(', ')));
  
  if (metaParts.length) {
    console.log(c.dim('  ') + metaParts.join(c.muted('  ·  ')));
  }
  
  // Show content preview (truncated)
  const contentPreview = content.split('\n').slice(0, 3).join('\n');
  const displayContent = contentPreview.length > 60 
    ? contentPreview.slice(0, 60) + '...'
    : contentPreview;
    
  if (content) {
    console.log(c.dim('  ') + '─'.repeat(Math.min(40, (process.stdout.columns || 80) - 4)));
    console.log(c.code('  ' + displayContent));
  }
  
  console.log('');
  
  // Action hints
  console.log(actionHint([
    'snip run ' + name + ':Run',
    'snip exec ' + name + ':Run now',
    'snip show ' + name + ':View',
  ]));
}

module.exports = add;
