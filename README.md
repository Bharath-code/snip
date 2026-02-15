# snip — CLI Snippet Manager

A lightweight, cross-platform CLI for saving, searching, sharing, and running reusable code and shell snippets.

Built as an opinionated MVP with a TUI for efficient snippet management, optional SQLite persistence, and GitHub Gist sync.

Highlights
- **Fast Workflow**: add/list/search/run directly from your shell
- **Interactive TUI**: Fuzzy search and keyboard-first navigation (`snip ui`)
- **Persistence Options**: Choose between JSON or SQLite (with WASM fallback)
- **Gist Sync**: Share and backup your snippets via GitHub Gists
- **Safety**: Automated detection of dangerous commands (e.g., `rm -rf`)

## Installation

Install globally via npm:

```bash
npm install -g snip-cli-manager
```

*Note: The package is currently named `snip-cli-manager` on npm.*

## Quick start

1. **Configure your editor** (optional, defaults to `$EDITOR` or `vi`):
   ```bash
   snip config set editor "vim"
   ```

2. **Add a snippet** from stdin:
   ```bash
   echo 'docker run --rm -it -v "$PWD":/work -w /work ubuntu:24.04 bash' | snip add docker-run --lang sh --tags docker,run
   ```

3. **List snippets**:
   ```bash
   snip list
   ```

4. **Interactive TUI**:
   ```bash
   snip ui
   ```

## Commands
| Command | Description |
|---------|-------------|
| `snip add <name>` | Save a new snippet |
| `snip ui` | Enter the interactive TUI |
| `snip list` | List all saved snippets |
| `snip search <q>` | Fuzzy search snippets |
| `snip run <id\|name>` | Execute a snippet |
| `snip edit <id\|name>` | Edit snippet content inline |
| `snip sync push <q>` | Upload to GitHub Gist |
| `snip sync pull <id>` | Download from GitHub Gist |
| `snip config` | View or change configuration |

## Features

### TUI Experience
The `snip ui` command provides a rich, split-pane interface inspired by modern terminal aesthetics. Use `j`/`k` to navigate, `e` to edit content, `a` to add new snippets, and `r` to run.

### SQLite Backend
For larger snippet libraries, enable SQLite:
```bash
snip config set useSqlite true
```
Requires `better-sqlite3` for native performance, or falls back to `sql.js` (WebAssembly).

## Contributing
Contributions are welcome! Please open an issue or submit a pull request.

## License
MIT © 2026 Bharath. See the [LICENSE](./LICENSE) file for details.

