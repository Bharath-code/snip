<h1 align="center">snip</h1>

<p align="center">
  <strong>Your terminal's memory.</strong><br>
  Save, search, and execute code snippets in milliseconds.
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
  <a href="#quick-start">Quick Start</a> ·
  <a href="#commands">Commands</a> ·
  <a href="docs/demo.md">Demo</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

<p align="center">
  <img src="docs/snip_sc_1.png" alt="snip CLI demo — list, search, exec" width="700">
</p>
<p align="center">
  <img src="docs/snip_sc_2.png" alt="snip TUI and pipeline mode" width="700">
</p>

## Why snip?

Most snippet managers only handle shell commands. **snip** handles _code_ — deploy scripts, API calls, Docker commands, JS utilities — across any language, with safety rails, a real TUI, and unix pipeline integration.

| Feature | snip | [pet](https://github.com/knqyf263/pet) | [navi](https://github.com/denisidoro/navi) | [tldr](https://github.com/tldr-pages/tldr) | dotfiles |
|---------|------|-----|------|------|--------|
| Run snippets directly | ✅ Any language | ✅ Shell only | ✅ Shell only | ❌ | ✅ Shell only |
| Multi-language (JS, Python, Ruby…) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Unix pipeline integration | ✅ `snip pipe` | ❌ | ❌ | ❌ | ❌ |
| Interactive TUI | ✅ Split-pane | ❌ | ✅ Basic | ❌ | ❌ |
| Dangerous command detection | ✅ | ❌ | ❌ | ❌ | ❌ |
| fzf integration | ✅ Native | ✅ | ✅ | ❌ | Manual |
| SQLite backend | ✅ Optional | ❌ | ❌ | ❌ | ❌ |
| Gist sync | ✅ | ✅ | ❌ | ❌ | Manual |
| Zero config | ✅ | ✅ | Needs cheats | ✅ | Heavy |

## Quick Start

```bash
# Install
npm install -g snip-manager

# Save a snippet
echo 'docker compose up -d --build' | snip add dc-up --lang sh --tags docker

# Find it
snip search docker

# Run it
snip exec dc-up

# Launch TUI
snip ui
```

## Installation

**Prerequisites:** Node.js ≥ 18

```bash
# npm
npm install -g snip-manager

# yarn
yarn global add snip-manager

# pnpm
pnpm add -g snip-manager

# verify
snip --version
snip doctor          # validates storage, editor, fzf, shell, gist
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `snip add <name>` | Save a snippet from stdin or `$EDITOR` |
| `snip list` | List all snippets (`--json`, `--tag`, `--lang`, `--sort`, `--limit`) |
| `snip search <query>` | Fuzzy search (`--json`, `--limit`) |
| `snip show <name>` | Display snippet (`--json`, `--raw`, `--edit`) |
| `snip run <name>` | Preview + confirm + execute (with template prompts) |
| `snip exec <name>` | Execute immediately, no modal (`--dry-run`, `--force`) |
| `snip pipe <name>` | Pipeline mode — stdin→template→stdout (`--json`, `--dry-run`) |
| `snip edit <name>` | Open in `$EDITOR` |
| `snip rm <name>` | Delete (alias: `delete`) |
| `snip update <name>` | Update metadata (`--tags`, `--lang`) |
| `snip last` | Re-run the last executed snippet |

### Utilities

| Command | Description |
|---------|-------------|
| `snip cp <src> <dest>` | Duplicate a snippet |
| `snip mv <old> <new>` | Rename a snippet |
| `snip cat <name>` | Print raw content to stdout |
| `snip recent [n]` | Show last _n_ used snippets (default: 5) |
| `snip stats` | Library statistics (`--json`, language chart, top tags, `--streak`) |
| `snip import-history` | Suggest commands from shell history (run 3+ times) |
| `snip grab <url>` | Import from URL or `github:user/repo/path` |
| `snip fzf` | fzf search with live preview |

### Integration

| Command | Description |
|---------|-------------|
| `snip alias [shell]` | Generate shell aliases (`eval "$(snip alias)"`) |
| `snip widget [shell]` | Ctrl+G hotkey widget for zsh/bash/fish |
| `snip completion [shell]` | Tab-completion script |
| `snip sync push [query]` | Push to GitHub Gist |
| `snip sync pull <id>` | Pull from GitHub Gist |
| `snip doctor` | Health check |
| `snip config <action>` | Get / set configuration |
| `snip ui` | Interactive TUI |
| `snip init` | Guided setup (editor, widget, example snippets, optional TUI) |

## Features

### Interactive TUI

```
snip ui
```

Split-pane interface with fuzzy search. Keyboard shortcuts:

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate |
| `/` | Live search |
| `Enter` | Preview |
| `r` | Run |
| `e` | Edit |
| `a` | Add new |
| `d` | Delete (type name to confirm, `z` to undo within 5s) |
| `s` | Cycle sort mode |
| `q` | Quit |

### Zero-Friction Execution

```bash
snip exec deploy-api            # run immediately
snip exec deploy-api --dry-run  # print only
snip exec deploy-api --force    # skip safety warning
```

### Parameterized Snippets

Use `{{variable}}` or `{{variable:default}}` syntax:

```bash
echo 'docker run --rm -it {{image:ubuntu:24.04}} {{cmd:bash}}' \
  | snip add docker-dev --lang sh --tags docker

snip run docker-dev
#   image [ubuntu:24.04]: node:20
#   cmd [bash]: ↵
```

Variables are auto-detected at runtime — no extra flags needed.

### Safety

Dangerous commands (`rm -rf`, `sudo`, system-level ops) are detected automatically. `snip run` shows a preview and requires explicit confirmation. `snip exec` warns but lets you `--force` past.

### Shell Aliases

```bash
eval "$(snip alias)"        # every snippet becomes a command
deploy-api                  # → snip exec deploy-api
```

### Ctrl+G Widget

```bash
# add to ~/.zshrc
eval "$(snip widget zsh)"
# press Ctrl+G anywhere → search → paste snippet inline
```

### Gist Sync

```bash
snip sync push               # push all
snip sync push docker        # push matching
snip sync pull <gist-id>     # pull
```

### fzf Integration

```bash
snip fzf                     # search + preview
snip fzf | pbcopy            # pipe to clipboard
```

### Pipeline Mode

```bash
# Run a snippet, pipe output forward
snip pipe deploy-api | tee /tmp/deploy.log

# Pipe JSON as template values — no interactive prompts
echo '{"host":"prod.api.com","branch":"main"}' | snip pipe deploy --json

# Stdin passthrough to the snippet's process
curl -s https://api.example.com/data | snip pipe parse-json

# Dry-run: see resolved content without executing
echo '{"image":"node:20"}' | snip pipe docker-dev --json --dry-run
```

Also pipe-friendly: `snip cat`, `snip show --raw`, `snip list --json`, `snip search --json`.

### Grab from URL

```bash
snip grab https://example.com/script.sh --tags ops
snip grab github:user/repo/scripts/backup.sh
```

Language auto-detected from extension and shebang.

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

SQLite uses `better-sqlite3` (native) or falls back to `sql.js` (WASM).

## Architecture

```
snip
├── bin/snip              # Entry point
├── lib/
│   ├── cli.js            # Command definitions (Commander.js)
│   ├── storage.js        # JSON + SQLite abstraction
│   ├── search.js         # Fuse.js fuzzy search
│   ├── exec.js           # Multi-language runner
│   ├── template.js       # {{var:default}} engine
│   ├── safety.js         # Dangerous command detection
│   ├── config.js         # Config loader
│   └── commands/         # One file per command
├── completions/          # Shell completions
├── __tests__/            # Jest test suite
├── scripts/              # Seed / smoke scripts
└── docs/                 # Website + demo
```

**Design decisions:**

- **Commander.js** for CLI parsing — battle-tested, zero-config subcommands.
- **Fuse.js** for fuzzy search — searches name, tags, and content simultaneously.
- **Dual storage** — JSON for instant start, SQLite for scale. Same API, swap with one config.
- **No daemon** — every invocation is stateless. Fast cold starts.
- **Blessed** for TUI — raw terminal control, no React/Ink overhead.

## Development

```bash
git clone https://github.com/Bharath-code/snip.git
cd snip
npm install

# Run locally
node bin/snip --help

# Seed example snippets
node bin/snip seed

# Run tests
npm test

# Lint
npm run lint
```

### Testing

Tests use [Jest](https://jestjs.io/) and cover storage, search, template engine, exec, safety, and CLI integration.

```bash
npm test                   # run all tests
npx jest --verbose         # verbose output
npx jest __tests__/exec.test.js  # single file
```

### Project Structure for Contributors

| Directory | Purpose |
|-----------|---------|
| `lib/commands/` | Add a new command = add one file here + register in `cli.js` |
| `lib/storage.js` | Storage abstraction — both backends |
| `__tests__/` | Mirror of `lib/` — one test file per module |
| `completions/` | Shell completion scripts |

## Troubleshooting

<details>
<summary><b>"command not found: snip"</b></summary>

Ensure npm's global bin is in your PATH:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

</details>

<details>
<summary><b>Editor not opening</b></summary>

```bash
snip config set editor "vim"     # or code, nvim, nano, subl
```

</details>

<details>
<summary><b>Permission errors on global install</b></summary>

Use [nvm](https://github.com/nvm-sh/nvm) to avoid `sudo`:

```bash
nvm install --lts
npm install -g snip-manager
```

</details>

## Roadmap

- [x] `snip pipe` — stdin pipeline integration
- [ ] Snippet groups / namespaces (`docker/cleanup`, `k8s/deploy`)
- [ ] Snippet versioning & history
- [ ] `snip share` — single-snippet gist sharing
- [ ] `snip diff a b` — diff two snippets
- [ ] AI snippet generation
- [ ] Team shared snippets

See [CHANGELOG.md](CHANGELOG.md) for release history.

## FAQ

<details>
<summary><b>What is snip?</b></summary>

A CLI tool for saving and running code snippets from the terminal. Think of it as a personal, searchable library for commands and code blocks you run repeatedly.
</details>

<details>
<summary><b>How is snip different from dotfiles?</b></summary>

Dotfiles store configuration. snip stores **executable snippets** — commands and code blocks you run. snip provides instant search, multi-language execution, and safety rails.
</details>

<details>
<summary><b>Does snip support custom languages?</b></summary>

Yes. Use `--lang` to specify any language. snip resolves the interpreter (node, python3, ruby, etc.) automatically.
</details>

<details>
<summary><b>Is my data secure?</b></summary>

Snippets are stored locally in `~/.snip/`. Nothing leaves your machine unless you explicitly `snip sync push` to GitHub Gist.
</details>

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

```bash
# Good first issues
# https://github.com/Bharath-code/snip/labels/good%20first%20issue
```

## Community

- [Issues](https://github.com/Bharath-code/snip/issues) — Bug reports & feature requests
- [Discussions](https://github.com/Bharath-code/snip/discussions) — Questions & ideas
- [Security Policy](SECURITY.md) — Vulnerability reporting

## License

[MIT](LICENSE) © [Bharath](https://github.com/Bharath-code)
