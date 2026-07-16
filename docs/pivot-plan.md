# snip pivot plan — "The snippet manager for AI agents"

**One-liner:** Your AI agent shouldn't guess your production commands. snip gives
Claude Code, Cursor, and any MCP client a verified, safety-checked command
library — versioned in your repo.

**Why pivot:** the human-memory snippet-manager category is dying (AI assistants
answer "what was that docker command" for free). The valuable inversion: AI
agents hallucinate commands; snip is the verified, executable, policy-guarded
library they pull from. The parts already exist (`lib/mcp-server.js`,
`lib/safety.js`, `lib/team.js` with git-checked-in `.snip/snippets.json`);
this plan is composition + repositioning, not a rebuild.

---

## Phase 1 — Reposition (week 1, no new features)

- [x] Rewrite README top fold: lead with MCP demo (agent transcript:
      `snip_search` → `snip_exec` dry-run → blocked dangerous command).
      Human CLI/TUI becomes section 2. Comparison table removed.
- [x] `snip mcp install [claude|cursor|goose|continue]` — writes the MCP
      config entry (claude via `claude mcp add`, cursor via `~/.cursor/mcp.json`,
      goose/continue print config).
- [x] Slim the install: removed `openai` (was entirely unused — `lib/ai/openai.js`
      uses native fetch); MCP SDK stays as a regular dep (it IS the product) and
      was already lazy-loaded. Lazy-loaded `lib/commands/ui.js` in `cli.js`
      (blessed + cli-highlight): `snip --help` 1.1s → 0.11s.
- [x] Repo cleanup: deleted `isolate-*.log`, `temp-sqljs.db`, `snip-0.1.0.tgz`,
      root `coverage/` (gitignore already covered them). Fixed accumulating
      signal handlers in `lib/storage.js`/`lib/exec.js` with process-level guards.
- [x] npm metadata: added keywords `mcp`, `model-context-protocol`, `ai-agents`,
      `claude`, `cursor`, `mcp-server`; agent-first description; bumped to 0.4.0.

**Exit criteria:** a stranger landing on the README understands "this is for my
AI agent" in 10 seconds and is running it in 2 minutes.

## Phase 2 — Sharpen the safety story (weeks 2–3)

- [x] `.snip/policy.json` (checked into repo): allow/deny patterns,
      `execRequiresApproval`, max runtime, allowed languages. Enforced by MCP
      `snip_exec` (`lib/policy.js`). Turns safety from a hardcoded list into
      team-governed guardrails.
- [x] Audit log: every MCP tool call appends to
      `~/.local/share/snip/audit.jsonl` (who/what/when/dry-run/blocked) —
      `lib/audit.js`, logged centrally in the MCP CallTool handler.
- [x] Approval flow: policy-gated `snip_exec` returns pending-approval;
      human confirms via `snip approve <id>` (or `--reject`). `lib/approvals.js`
      + `lib/commands/approve.js`.
- [x] Document `safety.js` regexes as "built-in deny rules" under the policy
      umbrella — `docs/policy.md`, linked from README Safety Model.

## Phase 3 — Team = the moat (weeks 3–5)

- [ ] Mental model: `.snip/` in a repo = "runbook". `snip init` scaffolds
      `snippets.json` + `policy.json` + README stub. Pitch: code-reviewed
      commands — agent PRs a snippet, human approves, every teammate's agent
      can use it.
- [ ] MCP reads team snippets first when cwd is in a repo; tag results
      `source: team|personal`.
- [ ] Snippet provenance in MCP responses: author, updatedAt, usage count.
- [ ] Defer hosted sync — git IS the sync backend; "no server, data stays in
      your repo" is a selling point.

## Phase 4 — Launch (week 6)

- [ ] 60-second VHS demo: agent asks for deploy command → gets team's verified
      one → `rm -rf` variant blocked by policy → audit log shown.
- [ ] Submit to: Anthropic MCP registry, mcp.so, PulseMCP, Cursor directory,
      Smithery.
- [ ] Show HN: "snip – a verified command library for AI agents (MCP)".
- [ ] Blog post: "Your AI agent shouldn't guess your production commands";
      cross-post r/ClaudeAI, X, dev.to.
- [ ] Per-client setup recipes (Claude Code, Cursor, Goose, Continue).

## Cut list (Phase 1)

Freeze (keep code, stop advertising/maintaining): streaks, dashboard, widget,
watch-history, discover, stats beyond usage counts. Drop OpenAI generation from
the headline — "another AI code generator" muddies "the safety layer for agent
commands."

## Money / job payoff

- **Job:** after Phase 2, the artifact is "policy-enforced, audited command
  execution for AI agents" — case study + repo = strong interview package.
- **Money (later, optional):** free for individuals + git teams; paid tier =
  org policy management + centralized audit (compliance buyers).
