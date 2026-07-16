/**
 * snip team — Team workspace snippet management
 *
 * Usage:
 *   snip team init [workspace]       — Create .snip/ directory in current dir
 *   snip team add <name>             — Add snippet to team file
 *   snip team list                   — List snippets from team file
 *   snip team sync                   — Import team snippets into local storage
 *   snip team push                   — Export local workspace snippets back to team file
 *   snip team status [--json]        — Show sync status between team and local
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const storage = require('../storage');
const team = require('../team');
const { c } = require('../colors');
const icons = require('../icons');
const { log } = require('../quiet');
const { section, actionHint, stripAnsi } = require('../format');
const { setExitCode, parseNameWithLang } = require('../cli-utils');

function teamCmd(subcmd, variadicArgs, opts = {}) {
  const args = Array.isArray(variadicArgs) ? variadicArgs : [];
  switch (subcmd) {
    case 'init':
      return init(args[0]);
    case 'add':
      return add(args[0], opts);
    case 'list':
      return listCmd();
    case 'sync':
      return syncCmd();
    case 'push':
      return pushCmd(opts);
    case 'status':
      return statusCmd(opts);
    default:
      console.error(c.err(`  ${icons.cross} Unknown team subcommand: `) + c.brand(subcmd));
      console.log(c.dim('  Usage: snip team init|add|list|sync|push|status'));
      console.log(c.dim('       snip team init [workspace]'));
      console.log(c.dim('       snip team add <name>'));
      console.log(c.dim('       snip team list'));
      console.log(c.dim('       snip team sync'));
      console.log(c.dim('       snip team push'));
      console.log(c.dim('       snip team status'));
      setExitCode(2); // misuse: unknown team subcommand
  }
}

function init(name) {
  const targetDir = process.cwd();
  const workspaceName = name || undefined;
  const result = team.initTeamDir(targetDir, workspaceName);

  log('');
  log(c.success(`  ${icons.check} Team workspace initialized`));
  log(c.dim(`  ${result.teamDir}/`));
  log(c.dim(`  Workspace: ${result.workspace}`));
  log('');
  log(actionHint([
    `snip team add deploy:Add snippet`,
    `snip team sync:Sync to local`,
    `snip team list:View snippets`,
  ]));
}

function add(name, opts) {
  if (!name) {
    console.error(c.err('  Error: Snippet name is required'));
    console.log(c.dim('  Usage: snip team add <name> --lang <lang>'));
    setExitCode(1);
    return;
  }

  // Read content from stdin, editor, or prompt
  const content = readContent(opts.content);
  if (!content) {
    console.error(c.err('  Error: No content provided'));
    console.log(c.dim('  Usage: echo "command" | snip team add <name>'));
    console.log(c.dim('       snip team add <name> (opens editor)'));
    setExitCode(1);
    return;
  }

  const { name: parsedName, lang: parsedLang } = parseNameWithLang(name);

  const targetDir = process.cwd();
  const result = team.addToTeam(targetDir, {
    name: parsedName,
    content,
    language: opts.lang || parsedLang || detectLanguage(content),
    tags: opts.tags ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
  });

  log('');
  log(c.success(`  ${icons.check} Added to workspace: ${c.brand(result.workspace)}`));
  log(c.dim(`  ${result.snippet.name} (${result.snippet.language || 'unknown'})`));
  log('');
  log(actionHint([
    `snip team sync:Sync to local`,
    `snip team list:View all team snippets`,
    `snip team status:Check sync status`,
  ]));
}

function listCmd() {
  const snippets = team.listTeam();
  if (!snippets || snippets.length === 0) {
    log(c.muted('  No team snippets found.'));
    log(c.dim('  Run snip team init to create a workspace'));
    log(c.dim('  or snip team add <name> to add snippets.'));
    return;
  }

  // Detect workspace
  const teamDir = team.detectTeamDir();
  const workspace = teamDir ? team.getWorkspaceName(teamDir) : 'unknown';

  // Check sync status for each
  const allLocal = storage.listSnippets();
  const wsTag = team.WORKSPACE_TAG_PREFIX + workspace;

  log('');
  log(c.brand(`  ${icons.folder} ${workspace}`) + c.muted(` · ${snippets.length} snippets`));
  log('');

  snippets.forEach((s, i) => {
    const localMatch = allLocal.find(l => l.name === s.name && (l.tags || []).includes(wsTag));
    const syncStatus = localMatch ? c.success('✓') : c.muted('○');
    const langIcon = icons.getLangIcon(s.language);
    const langStr = s.language ? c.code(`${langIcon} ${s.language}`) : '';
    const tagStr = s.tags && s.tags.length ? c.tag(s.tags.slice(0, 3).join(', ')) : '';
    const authorStr = s.author ? c.dim(`by ${s.author}`) : '';
    console.log(`  ${syncStatus} ${c.brand(s.name)}  ${langStr}  ${tagStr}  ${authorStr}`);
  });

  log('');
  log(actionHint([
    `snip team sync:Sync all to local`,
    `snip team add <name>:Add more`,
    `snip team status:Check status`,
  ]));
}

function syncCmd() {
  const result = team.syncFromTeam();

  if (result.imported === 0 && result.skipped === 0) {
    log(c.muted('  No team snippets found to sync.'));
    log(c.dim('  Run snip team init to create a workspace first.'));
    return;
  }

  log('');
  log(c.success(`  ${icons.check} Synced ${c.brand(result.workspace)}`));
  if (result.imported > 0) log(c.success(`  ${icons.add} ${result.imported} imported`));
  if (result.skipped > 0) log(c.muted(`  ${icons.arrow} ${result.skipped} skipped (already up-to-date)`));
  log('');
  log(actionHint([
    `snip team list:View team snippets`,
    `snip list --tag workspace:${result.workspace}:Local copies`,
    `snip team push:Export changes back`,
  ]));
}

function pushCmd(opts) {
  const result = team.pushToTeam(process.cwd(), opts);

  log('');
  if (result.pushed > 0) {
    log(c.success(`  ${icons.check} Pushed ${result.pushed} snippets to workspace`));
  } else {
    log(c.muted('  No workspace-tagged snippets found to push.'));
    log(c.dim('  Run snip team sync first to import team snippets,'));
    log(c.dim('  then edit them and run snip team push to export changes.'));
  }
  log('');
  log(actionHint([
    `snip team list:View team snippets`,
    `snip team status:Check sync status`,
  ]));
}

function statusCmd(opts) {
  const status = team.getTeamMergeStatus();

  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const teamDir = team.detectTeamDir();
  if (!teamDir) {
    log(c.muted('  No team workspace found.'));
    log(c.dim('  Run snip team init to create one in this directory.'));
    return;
  }

  log('');
  log(c.brand(`  ${icons.folder} ${status.workspace}`));
  log(c.dim(`  ${teamDir}/${team.TEAM_FILE_NAME}`));
  log('');

  // Summary line
  const total = status.inTeam.length;
  const synced = status.inLocal.length;
  const missing = status.missingLocal.length;
  log(`  ${c.brand(String(total))} ${c.muted('in team')}   ${c.brand(String(synced))} ${c.muted('synced locally')}   ${c.brand(String(missing))} ${c.muted('pending sync')}`);

  if (status.missingLocal.length > 0) {
    log('');
    log(c.warn('  Not yet synced:'));
    for (const s of status.missingLocal) {
      log(`    ${c.muted('○')} ${c.brand(s.name)}`);
    }
  }

  if (status.missingTeam.length > 0) {
    log('');
    log(c.info('  Local only (not in team file):'));
    for (const s of status.missingTeam) {
      const content = storage.readSnippetContent(s);
      log(`    ${c.muted('•')} ${c.brand(s.name)}  ${c.code(s.language || '')}  ${s.tags && s.tags.length ? c.tag(s.tags.join(', ')) : ''}`);
    }
  }

  log('');
  const hints = [];
  if (status.missingLocal.length > 0) hints.push('snip team sync:Pull from team');
  if (status.missingTeam.length > 0) hints.push('snip team push:Export to team');
  hints.push('snip team list:View all');
  log(actionHint(hints));
}

// ── Helpers ──

function readContent(contentArg) {
  // Content provided as argument
  if (contentArg) return contentArg;

  // Read from stdin (pipe mode)
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    // Data is piped in
    const buffer = fs.readFileSync(0, 'utf8');
    if (buffer.trim()) return buffer.trim();
  }

  // Open editor
  const editor = (require('../config').loadConfig().editor || 'vi').split(' ');
  const tmpFile = path.join(os.tmpdir(), `snip-team-add-${Date.now()}.tmp`);
  try {
    const result = spawnSync(editor[0], editor.slice(1).concat([tmpFile]), { stdio: 'inherit' });
    if (result.status === 0 && fs.existsSync(tmpFile)) {
      const content = fs.readFileSync(tmpFile, 'utf8').trim();
      return content || null;
    }
  } catch { /* */ }
  finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { }
  }

  return null;
}

const { detectLanguageFromCommand } = require('../language-detect');

function detectLanguage(content) {
  return detectLanguageFromCommand(content);
}

module.exports = teamCmd;
