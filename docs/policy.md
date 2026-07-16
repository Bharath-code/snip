# Execution policy, approvals & audit log

snip's MCP `snip_exec` tool is governed by two layers:

1. **Built-in deny rules** (`lib/safety.js`) — always on, cannot be disabled.
2. **Team policy** (`.snip/policy.json`) — optional, checked into your repo,
   code-reviewed like any other change.

## `.snip/policy.json`

Place next to `.snip/snippets.json` (found by walking up from cwd). All
fields optional:

```json
{
  "deny": ["kubectl\\s+delete", "terraform\\s+apply"],
  "allow": ["^npm\\s+", "^git\\s+"],
  "allowedLanguages": ["sh", "bash"],
  "execRequiresApproval": true,
  "maxRuntimeMs": 30000
}
```

| Field | Effect |
|-------|--------|
| `deny` | Regex patterns (case-insensitive, matched per line). Any match blocks execution. |
| `allow` | If non-empty, snippet content must match at least one pattern or it is blocked. Deny wins over allow. |
| `allowedLanguages` | If set, the snippet's language must be listed. |
| `execRequiresApproval` | Non-dry-run `snip_exec` calls are parked as pending approvals instead of executing. |
| `maxRuntimeMs` | Executions are killed after this many milliseconds (exit code 124). |

A dry-run `snip_exec` (the default) reports `blocked`, `blockedReason`, and
`requiresApproval` without executing, so agents can check before asking.

## Built-in deny rules

These patterns from `lib/safety.js` always block MCP execution, regardless of
policy (the CLI prompts a human for confirmation instead):

- `rm -rf` (including `sudo rm -rf`, `rm -rf /`, `rm -rf ~`)
- writing to raw devices / filesystems: `dd if=... of=/`, `mkfs.*`
- `shutdown` / `reboot`
- fork bombs (`:(){ :|:& };:`)
- `passwd` / `gpasswd`
- `killall -9`
- `docker rm -f`
- SQL `DROP TABLE`
- `chmod 777 /`
- piping downloads to a shell: `curl ... | sh`, `wget ... | bash`, `base64 -d | sh`
- `eval $(...)`

## Approval flow

With `execRequiresApproval: true`:

1. Agent calls `snip_exec` with `dry_run: false`.
2. snip parks the request and returns `{ status: "pending_approval", approvalId }`.
3. A human reviews and runs it: `snip approve <id>` (or `snip approve <id> --reject`).
4. `snip approve` with no id lists everything pending.

Dangerous-command confirmation still applies at approval time.

## Audit log

Every MCP tool call (and every approval decision) appends one JSON line to
`~/.local/share/snip/audit.jsonl` (respects `XDG_DATA_HOME`):

```json
{"ts":"2026-07-16T06:12:03.512Z","user":"jane","tool":"snip_exec","args":{"name":"db-backup","dry_run":false},"isError":false,"dryRun":false,"blocked":false,"exitCode":0}
```

Fields: `ts`, `user` (OS username), `tool`, `args`, `isError`, plus for
executions `dryRun`, `blocked`/`reason`, `pendingApproval`, `exitCode`, and
for CLI approvals `event: approval_executed | approval_rejected`.
