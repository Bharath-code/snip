/**
 * snip init — scaffold a repo runbook: .snip/ with snippets.json,
 * policy.json, and a README stub. Checked into git, shared by every
 * teammate (and their agents).
 */
const fs = require('fs');
const path = require('path');
const team = require('../team');
const { c } = require('../colors');
const icons = require('../icons');
const { log } = require('../quiet');
const { actionHint } = require('../format');

function initCmd(opts = {}) {
  const targetDir = process.cwd();
  const existed = fs.existsSync(path.join(targetDir, team.TEAM_DIR_NAME, team.TEAM_FILE_NAME));
  const result = team.initTeamDir(targetDir, opts.workspace);

  log('');
  if (existed) {
    log(c.success(`  ${icons.check} Runbook already initialized — filled in any missing files`));
  } else {
    log(c.success(`  ${icons.check} Runbook initialized`));
  }
  log(c.dim(`  ${result.teamDir}/`));
  log(c.dim(`    snippets.json  — team command library (code-review changes via PRs)`));
  log(c.dim(`    policy.json    — execution guardrails for AI agents`));
  log(c.dim(`    README.md      — what this is, for your teammates`));
  log(c.dim(`  Workspace: ${result.workspace}`));
  log('');
  log(actionHint([
    'snip team add deploy:Add a verified command',
    'snip mcp install claude:Wire up your AI agent',
    'git add .snip:Check it into the repo',
  ]));
}

module.exports = initCmd;
