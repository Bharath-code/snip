<h1 align="center">snip</h1>

<p align="center">
  <strong>The snippet manager for AI agents.</strong><br>
  Your AI agent shouldn't guess your production commands.<br>
  snip gives Claude Code, Cursor, and any MCP client a verified, safety-checked command library.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snip-manager"><img src="https://img.shields.io/npm/v/snip-manager.svg?style=flat-square&color=cb3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/snip-manager"><img src="https://img.shields.io/npm/dm/snip-manager.svg?style=flat-square&color=blue" alt="monthly downloads"></a>
  <a href="https://github.com/Bharath-code/snip/actions"><img src="https://img.shields.io/github/actions/workflow/status/Bharath-code/snip/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="https://codecov.io/gh/Bharath-code/snip"><img src="https://img.shields.io/codecov/c/github/Bharath-code/snip?style=flat-square&color=ff4d00&label=coverage" alt="coverage"></a>
  <a href="https://github.com/Bharath-code/snip/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/snip-manager.svg?style=flat-square" alt="license"></a>
  <a href="https://www.npmjs.com/package/snip-manager"><img src="https://img.shields.io/node/v/snip-manager?style=flat-square" alt="node version"></a>
</p>

<p align="center">
  <a href="https://bharath-code.github.io/snip/">Website</a> ·
  <a href="#quick-start-for-ai-agents">Agent Quick Start</a> ·
  <a href="#the-safety-model">Safety Model</a> ·
  <a href="#the-human-cli">Human CLI</a> ·
  <a href="#commands">Commands</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## Why snip?

AI coding agents are great at writing code and terrible at knowing *your* commands — the exact deploy script, the migration incantation, the `kubectl` flags your team actually uses. Left alone, they guess. Guessing at production commands is how incidents happen.

snip is the layer between your agent and your shell:

- **Verified** — agents pull from a curated library you (or your team) wrote, not from a hallucination.
- **Safety-checked** — execution is dry-run by default; destructive patterns (`rm -rf`, `curl | bash`, fork bombs…) are hard-blocked.
- **Team-shareable** — commit `.snip/snippets.json` to your repo and every teammate's agent uses the same code-reviewed commands.
- **Still a great human CLI** — fuzzy search, TUI, templates, multi-language execution. See [The human CLI](#the-human-cli).

## Quick Start for AI Agents

```bash
# Install
npm install -g snip-manager

# Wire it into your AI client (claude, cursor, goose, continue)
snip mcp install claude

# Give it something verified to work with
snip seed        # or: snip import-history, snip add …
```

Then, in your agent:

```
You:    deploy the api to staging

Agent:  → snip_search("deploy staging")
        → found "deploy-api-staging" (author: jane, used 47 times)
        → snip_exec("deploy-api-staging")           # dry-run by default
        Here's exactly what will run: … Confirm?

You:    yes

Agent:  → snip_exec("deploy-api-staging", dry_run: false)
        Deployed. Exit code 0.
```

And when an agent tries something it shouldn't:

```
Agent:  → snip_exec("cleanup-old-data", dry_run: false)
        ✗ Blocked: this snippet contains potentially destructive operations.
          Use the CLI directly to confirm execution.
```

### MCP Tools

The MCP server exposes 16 tools:

| Tool | Description | Safety |
|------|-------------|--------|
| `snip_search` | Fuzzy-search by name, tags, or content | Read-only |
| `snip_searchRelevance` | Search with relevance scores + `min_score` filter | Read-only |
| `snip_list` | List with tag/language/sort/limit filters | Read-only |
| `snip_read` | Read snippet content + metadata by name | Read-only |
| `snip_suggest` | Context-aware suggestions from current directory | Read-only |
| `snip_history` / `snip_diff` | Version history & diffs | Read-only |
| `snip_save` / `snip_edit` / `snip_rename` / `snip_delete` / `snip_undo` | Library management | Write |
| `snip_share` / `snip_unshare` / `snip_discover` | Public Gist sharing & discovery | Write (API) |
| `snip_exec` | Execute a snippet — **dry-run by default** | Execute |

Resources: `snip://snippets` (list) and `snip://snippets/{name}` (read) for clients that support resource reading.

### Connecting Clients

`snip mcp install <client>` handles this for you. Manual config, for any MCP client:

```json
{
  "mcpServers": {
    "snip": { "command": "snip", "args": ["mcp"] }
  }
}
```

| Client | Setup |
|--------|-------|
| **Claude Code** | `snip mcp install claude` (uses `claude mcp add`) |
| **Cursor** | `snip mcp install cursor` (writes `~/.cursor/mcp.json`) |
| **Goose** | `snip mcp install goose` (prints YAML for `~/.config/goose/config.yaml`) |
| **Continue** | `snip mcp install continue` (prints JSON for `~/.continue/config.json`) |
| **Anything else** | Use the generic `command`/`args` config above |

## The Safety Model

Five layers between an agent and a destructive command:

1. **Dry-run by default.** `snip_exec` returns what *would* run unless the agent explicitly passes `dry_run: false`. The agent (and you) see the full command content first.
2. **Built-in deny rules.** Destructive patterns — `rm -rf`, `dd of=/`, `mkfs`, fork bombs, `curl | bash`, `chmod 777 /`, and more — are detected per-line and **blocked over MCP entirely**. They can only be confirmed by a human, in the CLI, typing `yes`.
3. **Team policy.** A `.snip/policy.json` checked into your repo adds deny/allow patterns, a language allowlist, a max runtime, and can gate all agent execution behind human approval (`snip approve <id>`). See [docs/policy.md](docs/policy.md).
4. **Audit log.** Every MCP tool call and approval decision is appended to `~/.local/share/snip/audit.jsonl` — who, what, when, dry-run, blocked, exit code.
5. **Full visibility.** Every execution returns the exact content and exit code, so agents self-correct instead of retrying blind.

The same detection guards human usage: `snip run` previews and requires confirmation; `snip exec` warns and requires `--force`.

## Team Runbook

`.snip/` in a repo is a **runbook**: verified commands plus the policy that governs how agents may run them, versioned alongside the code they operate on.

```bash
snip init                 # scaffolds .snip/ — snippets.json + policy.json + README
snip team add deploy-api  # add a verified command (records author from git config)
git add .snip && git commit -m "runbook: deploy-api"
```

MCP reads the runbook first: team snippets rank above personal ones and every result carries `source: team|personal` plus provenance (author, updatedAt). An agent PRs a snippet, a human approves it, and every teammate's agent can use it — your agent's command vocabulary is **code-reviewed**. No sync server, no accounts — git is the backend and your data never leaves your repo.

---

## The Human CLI

snip started life as a terminal-native snippet manager, and it's still one — fuzzy search, split-pane TUI, `{{var:default}}` templates, and direct execution across any language (shell, JS/TS, Python, Ruby, PHP, Perl, PowerShell…).

<p align="center">
  <img src="https://vhs.charm.sh/vhs-68GMwpm0mG45CKI5fXvqYv.gif" alt="snip CLI demo — list, search, show, exec, add, stats, run" width="100%">
</p>

```bash
# Save a snippet
echo 'docker compose up -d --build' | snip add dc-up --lang sh --tags docker

# Find it
snip search docker

# Run it
snip exec dc-up

# Launch the TUI
snip ui
```

In a repo? `snip init` scaffolds the `.snip/` runbook (snippets + policy + README).

## Installation

**Prerequisites:** Node.js ≥ 18

```bash
npm install -g snip-manager    # or: yarn global add / pnpm add -g

snip --version
snip doctor          # validates storage, editor, fzf, shell, gist
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `snip add <name>` | Save a snippet from stdin or `$EDITOR` (`snip add:js` etc. for language shortcuts) |
| `snip list` | List all snippets (`--json`, `--tag`, `--lang`, `--sort`, `--limit`) |
| `snip search <query>` | Fuzzy search (`--json`, `--limit`) |
| `snip show <name>` | Display snippet (`--json`, `--raw`, `--edit`) |
| `snip run <name>` | Preview + confirm + execute (with template prompts) |
| `snip exec <name>` | Execute immediately (`--dry-run`, `--force`) |
| `snip pipe <name>` | Pipeline mode — stdin→template→stdout (`--json`, `--dry-run`) |
| `snip edit <name>` | Open in `$EDITOR` |
| `snip rm <name>` | Delete (`--force` to skip confirm) |
| `snip update <name>` | Update metadata (`--tags`, `--lang`) |
| `snip last` / `snip recent [n]` | Re-run last / show recently used |

### Agents & Team

| Command | Description |
|---------|-------------|
| `snip mcp` | Start the MCP server (stdio) |
| `snip mcp install <client>` | Configure snip for claude / cursor / goose / continue |
| `snip init` / `snip team init` | Scaffold the `.snip/` runbook in the repo |
| `snip team push` / `sync` / `status` | Share, import, and compare team snippets |

### Utilities & Integration

| Command | Description |
|---------|-------------|
| `snip cp` / `snip mv` / `snip cat` | Duplicate / rename / print raw |
| `snip stats` | Library statistics (`--json`, `--streak`) |
| `snip import-history` | Turn repeated shell-history commands into snippets |
| `snip grab <url>` | Import from URL or `github:user/repo/path` |
| `snip fzf` | fzf search with live preview |
| `snip alias [shell]` | Every snippet becomes a shell command (`eval "$(snip alias)"`) |
| `snip widget [shell]` | Ctrl+G hotkey widget for zsh/bash/fish |
| `snip completion [shell]` | Tab-completion (bash, zsh, fish) |
| `snip sync push/pull` | GitHub Gist sync |
| `snip share` / `unshare` / `discover` | Publish & find community snippets via Gists |
| `snip export` / `snip import` | JSON backup / restore |
| `snip doctor` / `snip config` / `snip ui` | Health check, config, TUI |

## Features

### Interactive TUI

`snip ui` — split-pane fuzzy-search interface (Catppuccin Mocha). `j/k` navigate, `/` search, `Enter` preview, `c` copy, `r` run, `e` edit, `a` add, `d` delete (with 5s undo), `t` tag filter, `s` sort, `q` quit. First launch shows keybinding hints.

### Parameterized Snippets

Use `{{variable}}` or `{{variable:default}}` — auto-detected at runtime, prompted interactively (or resolved from JSON in pipeline mode):

```bash
echo 'docker run --rm -it {{image:ubuntu:24.04}} {{cmd:bash}}' \
  | snip add docker-dev --lang sh --tags docker

snip run docker-dev
#   image [ubuntu:24.04]: node:20
#   cmd [bash]: ↵
```

### Pipeline Mode

```bash
snip pipe deploy-api | tee /tmp/deploy.log                         # pipe output
echo '{"host":"prod.api.com"}' | snip pipe deploy --json           # JSON template values
curl -s https://api.example.com/data | snip pipe parse-json        # stdin passthrough
```

Also pipe-friendly: `snip cat`, `snip show --raw`, `snip list --json`, `snip search --json`.

### Shell Integration

```bash
eval "$(snip alias)"          # every snippet becomes a command
eval "$(snip widget zsh)"     # Ctrl+G → search → paste inline
snip import-history --last 500  # mine your shell history for repeated commands
```

### Gist Sync & Sharing

```bash
snip sync push               # push your library to a Gist
snip sync pull <gist-id>     # pull
snip share deploy-api        # publish one snippet publicly
snip discover docker         # search community-shared snippets
```

Requires a GitHub token with `gist` scope in `SNIP_GIST_TOKEN`.

## Configuration

```bash
snip config set editor "code --wait"
snip config set useSqlite true       # for 100+ snippets
snip config list
```

| Option | Default | Description |
|--------|---------|-------------|
| `editor` | `$EDITOR` / `vi` | Snippet editor |
| `useSqlite` | `false` | SQLite instead of JSON |
| `snippetDir` | `~/.snip` | Data directory |

SQLite uses `better-sqlite3` (native) or falls back to `sql.js` (WASM). `snip doctor` diagnoses storage issues.

<details>
<summary><b>Optional: AI snippet generation</b></summary>

`snip ai generate "<prompt>"` generates snippets via the OpenAI API (`--lang`, `--tags`, `--name`, `--model`).

```bash
export SNIP_AI_API_KEY="sk-..."
snip ai generate "curl wrapper with retry" --name curl-retry
```

Config keys: `ai_provider`, `ai_model` (default `gpt-3.5-turbo`), `ai_max_tokens`, `ai_api_key`.
</details>

## Architecture

```
snip
├── bin/snip              # Entry point
├── lib/
│   ├── cli.js            # Command definitions (Commander.js)
│   ├── mcp-server.js     # MCP server — 16 tools + resources
│   ├── storage.js        # JSON + SQLite abstraction
│   ├── search.js         # Fuse.js fuzzy search
│   ├── exec.js           # Multi-language runner
│   ├── template.js       # {{var:default}} engine
│   ├── safety.js         # Dangerous command detection
│   ├── team.js           # Repo-local .snip/ team library
│   ├── sync/             # Gist sync module
│   └── commands/         # One file per command
├── completions/          # Shell completions (bash, zsh, fish)
├── __tests__/            # Jest test suite
└── docs/                 # Website + demo + pivot plan
```

**Design decisions:**

- **No daemon** — every invocation is stateless; sub-150ms cold starts (heavy modules lazy-load).
- **Dual storage** — JSON for instant start, SQLite for scale; same API.
- **Git as team backend** — `.snip/` lives in your repo; no server, no accounts.
- **Blessed** for TUI — raw terminal control, no React/Ink overhead.

## Development

```bash
git clone https://github.com/Bharath-code/snip.git
cd snip && npm install

node bin/snip --help     # run locally
node bin/snip seed       # example snippets
npm test                 # Jest suite
npm run lint             # ESLint
```

Adding a command = one file in `lib/commands/` + registration in `lib/cli.js`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Troubleshooting

<details>
<summary><b>"command not found: snip"</b></summary>

Ensure npm's global bin is in your PATH:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

</details>

<details>
<summary><b>Agent can't see snip tools</b></summary>

1. Verify the server starts: `snip mcp` (should wait silently on stdio; Ctrl+C to exit).
2. Re-run `snip mcp install <client>` and restart the client.
3. Check the client's MCP logs — the server name is `snip`.

</details>

<details>
<summary><b>Editor not opening</b></summary>

```bash
snip config set editor "vim"     # or code, nvim, nano, subl
```

</details>

<details>
<summary><b>GitHub token errors with Gist sync</b></summary>

```bash
export SNIP_GIST_TOKEN=your_token_here
```

Generate a token at https://github.com/settings/tokens with `gist` scope.

</details>

<details>
<summary><b>SQLite mode errors</b></summary>

```bash
npm install -g better-sqlite3    # native module
# or stay on the JSON backend (default)
snip config set useSqlite false
```

</details>

## Roadmap

The current direction — policy files, audit logging, and approval flows for agent execution — is laid out in [docs/pivot-plan.md](docs/pivot-plan.md). Release history in [CHANGELOG.md](CHANGELOG.md).

## FAQ

<details>
<summary><b>Why not just let the agent run commands directly?</b></summary>

Agents already can — that's the problem. snip narrows what they run to a library you curated, makes execution dry-run by default, and hard-blocks destructive patterns. It's the difference between "the agent can run anything" and "the agent runs what your team verified."
</details>

<details>
<summary><b>Is my data secure?</b></summary>

Snippets are stored locally in `~/.snip/` (or your repo's `.snip/`). Nothing leaves your machine unless you explicitly `snip sync push` or `snip share`.
</details>

<details>
<summary><b>Does snip support custom languages?</b></summary>

Yes. Use `--lang` — snip resolves the interpreter (node, python3, ruby, etc.) automatically, falling back to your shell.
</details>

## Community

- [Issues](https://github.com/Bharath-code/snip/issues) — bug reports & feature requests
- [Discussions](https://github.com/Bharath-code/snip/discussions) — questions & ideas
- [Security Policy](SECURITY.md) — vulnerability reporting

## License

[MIT](LICENSE) © [Bharath](https://github.com/Bharath-code)
