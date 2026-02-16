# snip — CLI Snippet Manager

<p align="center">
  <a href="https://www.npmjs.com/package/snip-manager">
    <img src="https://img.shields.io/npm/v/snip-manager.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/snip-manager">
    <img src="https://img.shields.io/npm/dt/snip-manager.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/bharath/snip/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/snip-manager.svg" alt="MIT License">
  </a>
  <a href="https://github.com/bharath/snip/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/bharath/snip/node.js.yml" alt="Build Status">
  </a>
</p>

> A lightweight, cross-platform CLI for saving, searching, sharing, and running reusable code and shell snippets. Built for developers who live in the terminal.

## Why snip?

Stop hunting through your shell history for that one command. **snip** is your terminal's memory — save, search, and execute code snippets in milliseconds.

- ⚡ **Lightning Fast** — Add, search, and run snippets in milliseconds
- 🔍 **Fuzzy Search** — Find anything instantly across names, tags, and content
- 🛡️ **Safety First** — Preview commands before execution, auto-detect dangerous operations
- 🎨 **Interactive TUI** — Keyboard-first terminal UI with split-pane interface
- 💾 **Flexible Storage** — JSON for simplicity, SQLite for scale
- 🔄 **Gist Sync** — Backup and share via GitHub Gists

## Quick Start

```bash
# Install globally
npm install -g snip-manager

# Add a snippet from stdin
echo 'docker run --rm -it -v "$PWD":/work -w /work ubuntu:24.04 bash' | snip add docker-run --lang sh --tags docker,run

# Or add from your editor (opens $EDITOR)
snip add my-script --lang bash --tags deploy,production

# Search snippets
snip search docker

# Run a snippet
snip run docker-run

# Launch interactive TUI
snip ui
```

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Install via npm

```bash
npm install -g snip-manager
```

### Install via yarn

```bash
yarn global add snip-manager
```

### Verify Installation

```bash
snip --version
```

## Commands

| Command | Description |
|---------|-------------|
| `snip add <name> --lang <lang> --tags <tag1,tag2>` | Save a new snippet from stdin or editor |
| `snip ui` | Launch interactive TUI with fuzzy search |
| `snip list` | List all saved snippets |
| `snip search <query>` | Fuzzy search across all snippets |
| `snip run <id\|name>` | Execute a snippet safely |
| `snip edit <id\|name>` | Edit snippet content inline |
| `snip delete <id\|name>` | Remove a snippet |
| `snip sync push [query]` | Upload matching snippets to GitHub Gist |
| `snip sync pull <gist-id>` | Download snippets from GitHub Gist |
| `snip config` | View or modify configuration |
| `snip --version` | Show version information |
| `snip --help` | Display help information |

## Configuration

### Set Your Editor

```bash
snip config set editor "vim"
```

Supported editors: `vim`, `nvim`, `nano`, `code`, `subl`

### Enable SQLite Backend

For larger snippet libraries (100+ snippets):

```bash
snip config set useSqlite true
```

Requires `better-sqlite3` for native performance, or falls back to `sql.js` (WebAssembly).

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `editor` | `$EDITOR` or `vi` | Default editor for snippet creation |
| `useSqlite` | `false` | Use SQLite instead of JSON storage |
| `snippetDir` | `~/.snip` | Custom snippets directory |

## Features

### Interactive TUI

Launch `snip ui` for a rich, split-pane interface:

- **Navigation**: `j`/`k` or arrow keys to move up/down
- **Search**: Type to fuzzy filter in real-time
- **Add**: Press `a` to create a new snippet
- **Edit**: Press `e` to edit selected snippet
- **Run**: Press `r` to execute (shows preview first)
- **Quit**: `q` or `Ctrl+C`

### Safety Features

snip automatically detects potentially dangerous commands:

- `rm -rf` and similar recursive deletions
- `sudo` commands
- Network-intensive operations
- Commands that could modify system state

Preview is shown before execution — you confirm before running.

### GitHub Gist Sync

Backup and share your snippet library:

```bash
# Push all snippets to a new Gist
snip sync push

# Push matching snippets
snip sync push docker

# Pull from existing Gist
snip sync pull <gist-id>
```

## Troubleshooting

### "command not found: snip"

Ensure npm global bin directory is in your PATH:

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$(npm global bin):$PATH"
```

### Editor Not Opening

Set your preferred editor:

```bash
snip config set editor "vim"
```

### Permission Errors

Fix npm permissions:

```bash
# Option 1: Use nvm
nvm install --lts
npm install -g snip-manager

# Option 2: Use sudo (not recommended)
sudo npm install -g snip-manager
```

## Frequently Asked Questions

### What is snip?

snip is a CLI tool that helps developers manage and reuse code snippets directly from the terminal. Think of it as a personal library for your most-used commands and code blocks.

### How is snip different from dotfiles?

dotfiles store configuration files, while snip focuses specifically on **executable snippets** — commands and code blocks you run repeatedly. snip provides instant search and one-command execution.

### Does snip support custom languages?

Yes! Use `--lang` to specify the language:

```bash
snip add deploy --lang python --tags deploy
```

### Can I import/export snippets?

Yes, via GitHub Gist sync:

```bash
# Export to Gist
snip sync push

# Import from Gist
snip sync pull <gist-id>
```

### Is my data secure?

Local snippets are stored in `~/.snip/` by default. Gist sync requires GitHub authentication. All data stays on your machine unless you explicitly choose to sync.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

See [SECURITY.md](SECURITY.md) for our security policy and reporting guidelines.

## License

MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built for developers who live in the terminal. ⚡
</p>
