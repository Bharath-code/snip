/**
 * snip init — guided onboarding: editor, widget, seed, optional TUI.
 */
const config = require('../config');
const { question } = require('../readline');
const { c } = require('../colors');

async function initCmd() {
  console.log(c.accent('\n  ─── snip init ───\n'));

  const cfg = config.loadConfig();
  const shell = (process.env.SHELL || 'sh').toLowerCase();
  const shellName = shell.includes('zsh') ? 'zsh' : shell.includes('fish') ? 'fish' : 'bash';

  // 1. Editor (optional override)
  const currentEditor = cfg.editor || process.env.EDITOR || 'vi';
  const editorAnswer = await question(c.dim(`  Editor for snip edit [${currentEditor}]: `));
  if (editorAnswer.trim()) config.saveConfig({ editor: editorAnswer.trim() });

  // 2. Widget setup hint
  console.log(c.accent('\n  Widget (Ctrl+G): add this to your ~/.'));
  if (shellName === 'fish') {
    console.log(c.dim('  snip widget fish | source'));
  } else {
    console.log(c.dim(`  eval "$(snip widget ${shellName})"`));
  }
  const addWidget = await question(c.dim('  Add widget line to your shell config now? (y/N): '));
  if (addWidget.trim().toLowerCase() === 'y' || addWidget.trim().toLowerCase() === 'yes') {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const rc = shellName === 'fish' ? path.join(os.homedir(), '.config', 'fish', 'config.fish') : path.join(os.homedir(), `.${shellName}rc`);
    const line = shellName === 'fish' ? '\n# snip widget (Ctrl+G)\nsnip widget fish | source\n' : `\n# snip widget (Ctrl+G)\neval "$(snip widget ${shellName})"\n`;
    try {
      fs.appendFileSync(rc, line);
      console.log(c.success(`  Appended to ${rc}`));
    } catch (e) {
      console.log(c.warn(`  Could not write ${rc}: ${e.message}`));
    }
  }

  // 3. Seed examples
  const seedAnswer = await question(c.dim('\n  Seed 10 example snippets? (Y/n): '));
  if (seedAnswer.trim().toLowerCase() !== 'n' && seedAnswer.trim().toLowerCase() !== 'no') {
    const path = require('path');
    const seedPath = path.join(__dirname, '..', '..', 'scripts', 'seed-examples.js');
    const seedCmd = require(seedPath);
    if (seedCmd.main) seedCmd.main();
  }

  // 4. Open TUI?
  const openUi = await question(c.dim('\n  Open TUI now? (y/N): '));
  if (openUi.trim().toLowerCase() === 'y' || openUi.trim().toLowerCase() === 'yes') {
    const uiCmd = require('./ui');
    uiCmd();
  } else {
    console.log(c.accent('\n  Done. Try: snip list, snip run <name>, or snip ui\n'));
  }
}

module.exports = initCmd;
