# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**snip** (`snip-manager` on npm) — a terminal-native CLI snippet manager with TUI, fuzzy search, multi-language execution, and optional SQLite/Gist sync. Node.js ≥ 18, CJS modules throughout.

## Commands

```bash
npm test                              # run all Jest tests
npm run lint                          # ESLint on lib/
npx jest __tests__/storage.test.js    # single test file
npx jest --verbose                    # verbose output
npx jest --coverage                   # with coverage report
node bin/snip --help                  # run CLI locally
node bin/snip seed                    # seed example snippets
```

## Architecture

**Entry point:** `bin/snip` → `lib/cli.js` (Commander.js program with all subcommands registered).

**Core modules:**

| Module | Role |
|--------|------|
| `lib/storage.js` | Unified storage API — transparent JSON (default) or SQLite backend. Dual-backend via `better-sqlite3` (native, preferred) with `sql.js` (WASM) fallback. In-memory JSON cache (`_jsonDb`) and SQLite connection cache (`_dbCache`). |
| `lib/search.js` | Fuse.js fuzzy search with mtime-based cache invalidation (avoids rebuilding index on every query). |
| `lib/exec.js` | Multi-language runner — resolves interpreter by language, writes snippet to temp file, executes with `spawnSync`. Handles SIGINT/SIGTERM cleanup. |
| `lib/template.js` | `{{variable:default}}` template engine — auto-detects variables at runtime, prompts user. |
| `lib/safety.js` | Dangerous command detection (`rm -rf`, `sudo`, etc.). |
| `lib/config.js` | Config loader — reads from `XDG_CONFIG_HOME` or `~/.config/snip/config.json`. |
| `lib/commands/` | One file per CLI subcommand, imported by `cli.js`. |

**Adding a new command:** create `lib/commands/<name>.js` and register it in `lib/cli.js`.

**Storage backends:** JSON is default; SQLite activated via `snip config set useSqlite true` or a `.sqlite`/`.db` `dbPath`. Both backends expose the same API. `better-sqlite3` must be installed separately (not in `package.json` deps) — `sql.js` is the devDependency fallback.

**TUI:** `lib/commands/ui.js` uses `blessed`. It is explicitly excluded from coverage collection and not unit-tested.

## Testing

Tests use `jest.setup.js` to redirect `XDG_CONFIG_HOME` and `XDG_DATA_HOME` to per-process temp dirs, fully isolating tests from user data. Coverage thresholds are low (30–40%) by design. `lib/commands/ui.js` and `lib/migrate_to_sqlite.js` are excluded from coverage.
