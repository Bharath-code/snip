/**
 * snip approve [id] — Human confirmation for policy-gated agent executions.
 * No id: list pending approvals. With id: preview + execute (or --reject).
 */

const approvals = require('../approvals');
const audit = require('../audit');
const exec = require('../exec');
const safety = require('../safety');
const policy = require('../policy');
const config = require('../config');
const storage = require('../storage');
const { c } = require('../colors');
const { setExitCode } = require('../cli-utils');

async function approveCmd(id, opts = {}) {
  if (!id) {
    const pending = approvals.list();
    if (!pending.length) {
      console.log('No pending approvals.');
      return;
    }
    console.log(`Pending approvals (${pending.length}):\n`);
    for (const e of pending) {
      console.log(`  ${c.brand(e.id)}  ${e.snippet} [${e.language || '?'}]  ${e.createdAt}`);
    }
    console.log(c.dim('\n  snip approve <id>           execute'));
    console.log(c.dim('  snip approve <id> --reject  discard'));
    return;
  }

  const entry = approvals.get(id);
  if (!entry) {
    console.error(c.err(`No pending approval with id "${id}"`));
    setExitCode(1);
    return;
  }

  if (opts.reject) {
    approvals.remove(id);
    audit.append({ event: 'approval_rejected', approvalId: id, snippet: entry.snippet });
    console.log(`Rejected "${entry.snippet}" (${id}).`);
    return;
  }

  console.log(`Snippet: ${c.brand(entry.snippet)} [${entry.language || '?'}]`);
  console.log(`Requested: ${entry.createdAt}\n`);
  entry.content.split('\n').forEach(l => console.log(`  ${l}`));
  console.log('');

  if (safety.isDangerous(entry.content)) {
    const ok = await safety.confirmDangerous(entry.content);
    if (!ok) {
      console.log('Aborted. Approval kept pending.');
      setExitCode(1);
      return;
    }
  }

  const pol = policy.loadPolicy();
  const cfg = config.loadConfig();
  const status = exec.runSnippetContent(entry.content, {
    shell: cfg.defaultShell,
    language: entry.language,
    timeout: pol.maxRuntimeMs || undefined,
  });

  approvals.remove(id);
  audit.append({
    event: 'approval_executed',
    approvalId: id,
    snippet: entry.snippet,
    exitCode: status,
  });

  const snippet = storage.getSnippetByIdOrName(entry.snippet);
  if (status === 0 && snippet) storage.touchUsage(snippet);

  if (status !== 0) setExitCode(status);
}

module.exports = approveCmd;
