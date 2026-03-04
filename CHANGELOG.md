# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Snippet versioning / history
- Snippet groups / namespaces
- `snip share` — single-snippet gist sharing
- `snip diff a b` — diff two snippets

## [0.3.0] - 2026-03-04

### Added
- `snip pipe` — unix pipeline integration (`--json`, `--dry-run`)
  - Pipe JSON as template values: `echo '{"host":"prod"}' | snip pipe deploy --json`
  - Stdin passthrough to snippet process
  - Zero-chrome output for composability
- `stdinData` support in exec engine for stdin passthrough to child processes
- Pipeline integration row in comparison tables (README + docs site)

### Changed
- README: added `snip pipe` to commands table, replaced "Pipe-Friendly" section with "Pipeline Mode", marked pipe as shipped in roadmap
- docs/index.html: updated feature card to "Unix Pipeline Mode", added comparison row, bumped CLI commands count to 20+
- CHANGELOG: restructured unreleased section

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

[Unreleased]: https://github.com/Bharath-code/snip/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Bharath-code/snip/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Bharath-code/snip/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Bharath-code/snip/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Bharath-code/snip/releases/tag/v0.1.0
