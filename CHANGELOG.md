# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Snippet versioning / history
- Snippet groups / namespaces (`docker/cleanup`, `k8s/deploy`)
- `snip share` — single-snippet gist sharing
- `snip diff a b` — diff two snippets
- AI snippet generation (`snip ai generate`)
- Team shared snippets
- VS Code / Neovim extension

## [0.4.0] - 2026-03-14

### Added
- **`snip init`** — guided setup wizard for zero-to-aha in 60 seconds
  - Interactive editor selection (vim, code, nano, etc.)
  - Automatic Ctrl+G widget installation for zsh/bash/fish
  - Seeds 10 example snippets to get started
  - Optional TUI tour on first launch
- **`snip import-history`** — import repeated commands from shell history
  - Analyzes last N commands (default: 500)
  - Suggests commands run 3+ times as snippets
  - Options: `--last <n>`, `--min-count <n>`, `--json`
- **`snip last`** — re-run the last executed snippet
  - Like `!!` but for your snippet library
  - Stores last snippet id/name in config
- **`snip stats --streak`** — days-in-a-row usage tracking
  - Habit-forming streak counter
  - Shows last used date
  - JSON output support for scripting
- **Catppuccin Mocha TUI theme** — beautiful, modern color palette
  - First-run overlays with keybinding hints
  - Improved visual consistency across all TUI screens
- **Enhanced error messages** with next-step guidance
  - "Snippet not found" → suggests `snip search` or similar names
  - GitHub 401 errors → clear PAT token instructions
  - SQLite errors → suggests installing `better-sqlite3`
- **`snip doctor` enhancements**
  - Checks for Ctrl+G widget installation
  - Detects missing `better-sqlite3` when SQLite enabled
  - Better actionable fix messages
- **Config validation** — type checking for `snip config` values
  - Rejects invalid keys and types with helpful errors
  - Lists allowed options in help text
- **Terminal width detection** — `snip list` now respects `process.stdout.columns`
  - Dynamic column widths based on terminal size
  - No more truncated output on wide terminals or sparse on narrow ones
- **Natural language search** — improved Fuse.js weighting
  - Description field now first-class in search
  - Better results for queries like "find my docker cleanup command"

### Changed
- **Safety improvements** — `--confirm` flag now only skips prompt, never danger checks
  - Dangerous commands always require explicit confirmation
  - Security regression fixed from v0.3.0
- **Performance optimizations**
  - Removed `mkdirp`, `uuid`, `fs-extra`, `readline-sync` dependencies (~900 kB lighter)
  - Using native Node.js 18+ APIs (`crypto.randomUUID()`, `fs.mkdirSync`)
  - Fuse index cache invalidation — only rebuilds when snippet count or DB mtime changes
  - Lazy-load snippet content — metadata-only for `list`/`search`, content on-demand
- **Improved `snip run` vs `snip exec` documentation**
  - Clearer help text explaining when to use each
  - `snip run` = preview + confirm (interactive)
  - `snip exec` = immediate execution (scripts)
- **Better first-run experience**
  - Prominent onboarding message when no snippets exist
  - Hints to run `snip seed` or `snip doctor`
  - TUI shows helpful overlays on first launch
- **Gist sync error handling**
  - 401 errors now show clear token setup instructions
  - Gist conflict detection warns before overwriting local changes
- **SQLite backend improvements**
  - `better-sqlite3` now properly detected and suggested
  - `snip edit` in SQLite mode properly persists edits
  - Better error messages for SQLite-related issues
- **`snip recent` command** — improved edge case handling
  - Better empty history behavior
  - Added test coverage
- **Unified brand colors** — `#ff4d00` orange across all CLI output
  - Consistent color palette in list, search, show, run, stats
  - `--no-color` and `NO_COLOR` env respected everywhere

### Fixed
- **Security**: `--confirm` bypass vulnerability — danger checks now always run
- **Storage**: Added file lock for JSON backend to prevent corruption on concurrent writes
- **Template engine**: Replaced `process.exit(1)` with `throw new Error()` for programmatic use
- **`snip edit` (SQLite)**: Edits now persist correctly when editor saves
- **Gist conflicts**: Warns when pulling would overwrite local changes

### Removed
- **Dependencies**: Removed 4 packages to reduce bundle size by ~900 kB
  - `mkdirp` → replaced with `fs.mkdirSync(path, { recursive: true })`
  - `uuid` → replaced with `crypto.randomUUID()`
  - `fs-extra` → replaced with native `fs`
  - `readline-sync` → replaced with native `readline` (async)

### Internal
- Extracted `lib/colors.js` — single source of truth for chalk + fallback
- Centralized `process.exit()` handling in `cli.js` where possible
- Improved error handling consistency across all commands
- Enhanced `lib/safety.js` test coverage for all 14 danger patterns

## [0.3.0] - 2026-03-04

### Added
- `snip pipe` — unix pipeline integration (`--json`, `--dry-run`)
  - Pipe JSON as template values: `echo '{"host":"prod"}' | snip pipe deploy --json`
  - Stdin passthrough to snippet process
  - Zero-chrome output for composability
- `snip stats --json` — machine-readable statistics output
- `stdinData` support in exec engine for stdin passthrough to child processes
- Pipeline integration row in comparison tables (README + docs site)
- Codecov coverage badge in README
- Demo screenshots in README (`snip_sc_1.png`, `snip_sc_2.png`)

### Changed
- `snip stats` extracted to its own command file with brand-colored output, language bar chart, and top tags
- Unified CLI color palette to brand orange `#ff4d00` across list, search, show, run, stats
- README: added `snip pipe` to commands table, replaced "Pipe-Friendly" section with "Pipeline Mode", marked pipe as shipped in roadmap
- docs/index.html: updated feature card to "Unix Pipeline Mode", added comparison row, bumped CLI commands count to 20+
- `jest.config.js`: added coverage config (collectCoverageFrom, thresholds, reporters)
- `color_scheme.md`: rewritten to match actual unified brand palette

## [0.2.0] - 2026-02-27

### Added
- `snip exec` — zero-friction snippet execution (no preview modal)
- `snip alias` — shell alias generator for bash, zsh, and fish
- `snip doctor` — health check (storage, editor, fzf, gist, completions)
- `snip cp` / `snip mv` / `snip cat` / `snip recent` / `snip stats`
- `snip grab` — import snippets from URLs and `github:user/repo/path`
- `snip widget` — Ctrl+G hotkey widget for zsh, bash, fish
- `--json` output on `list`, `show`, `search`
- `--limit` option on `list` and `search`
- `--raw` flag on `show` for piping
- Parameterized snippets with `{{var:default}}` syntax
- Smart template auto-detection in `snip run`
- Dangerous command detection with inline confirmation
- Colorized output with `--no-color` global flag
- Chalk-based colored terminal output (graceful fallback)
- Language alias normalization (`js` ↔ `javascript`, `py` ↔ `python`)
- Search index caching for performance
- Import validation and content-length guard for `grab`
- ESLint configuration and JSDoc comments
- First-run onboarding message

### Changed
- `snip run` now auto-prompts for template variables inline
- Shell completions updated to include all new commands

## [0.1.1] - 2026-02-16

### Added
- Initial npm release
- Basic snippet CRUD operations (add, list, show, edit, rm, update)
- Fuzzy search with Fuse.js
- Configuration management (`snip config`)
- Shell completions for bash and fish
- `snip fzf` integration

## [0.1.0] - 2026-02-15

### Added
- Interactive TUI with split-pane preview (`snip ui`)
- JSON and SQLite dual storage backends
- GitHub Gist sync (push / pull)
- Safety preview for command execution
- Multi-language snippet runner (sh, bash, node, python, ruby, php, perl, powershell)
- Export / import (JSON)

[Unreleased]: https://github.com/Bharath-code/snip/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Bharath-code/snip/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Bharath-code/snip/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Bharath-code/snip/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Bharath-code/snip/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Bharath-code/snip/releases/tag/v0.1.0
