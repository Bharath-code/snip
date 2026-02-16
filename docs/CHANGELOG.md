# Changelog

## Unreleased

- **snip seed:** Clears all snippet data (local JSON DB and SQLite if present) and populates with 10 example snippets (git, docker, npm, http, util, demo). Use after install or to reset. Run `node scripts/seed-examples.js` or `snip seed`.
- **snip ui (TUI):** Interactive terminal UI with fuzzy search, list navigation (j/k or arrows), Enter to show snippet, r to run (preview + y/N confirm), t to toggle tag filter, / to search, q to quit. Requires a TTY. Uses same storage, run flow, and safety as the CLI. Documented in README.
- **snip ui polish:** Updated color hierarchy and spacing, added fast keyboard jumps (`Ctrl+d`/`Ctrl+u`), added `c` to copy selected snippet content, and added copy support directly inside the Enter-details modal (`c`/`y`).
- **TUI edge-case hardening:** Modal sizing now adapts to small terminals, run preview focus/scroll behavior was fixed, help overlay now closes on any key, and details view adds pager open (`p`) for native text selection/copy.
- **List sorting:** Added `snip list --sort <name|usage|recent>`.
- **Language-aware run:** Snippets now execute with interpreter selection by language (`js`, `ts`, `py`, `rb`, `php`, `pl`, `ps1` and shell languages), with clearer missing-interpreter errors.
- **Test isolation:** Jest setup now sets `XDG_CONFIG_HOME` and `XDG_DATA_HOME` to temp dirs per worker so tests no longer use your real config or snippet DB. Added `jest.setup.js` and `jest.config.js` (with `watchman: false` for environments where watchman is unavailable).
- **SNIP_GIST_TOKEN:** Gist token can be set via the `SNIP_GIST_TOKEN` environment variable; it overrides `gist_token` from config so the token need not be stored on disk. Documented in README; sync command error message updated to mention the env var.
- Added sql.js fallback for portable SQLite support (enables use without native builds)
- Added `.github/workflows/ci-matrix.yml` to validate native and sql.js paths across OS matrix
- Added `scripts/sqljs-smoke.js` and `npm run smoke-sqljs` for local smoke testing of sql.js persistence
- Added `.gitignore` and small packaging/publish guidance in README
