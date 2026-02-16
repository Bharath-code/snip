# CLI Snippet Manager — Detailed Implementation Plan

Date: 2026-02-14

Overview
- Product: CLI Snippet Manager (snip) — a keyboard-first, local-first tool for capturing, organizing, searching, viewing, sharing, and safely executing small code snippets and command fragments.
- Target user: Solo developer who wants fast recall and safe execution of snippets from the terminal.

1) Current state
- No existing project files detected in the working directory; plan targets a new Node.js project scaffold.
- Session plan and artifacts will be created under the session folder for iterative development.

2) Purpose, core problem, and success criteria
- Core problem: friction when capturing and reusing small code fragments and terminal commands — current approaches are ad-hoc (dotfiles, notes, gist lists, shell history) and often slow to retrieve or unsafe to run.
- Purpose: eliminate friction by providing near-instant capture (editor or stdin), fuzzy recall, tag-based organization, and safe execution with preview and sandbox options.
- Success criteria: frequent daily reuse of snippets, measurable time saved during common tasks, high NPS from the solo developer audience.

3) Differentiation and value (why users will love it)
- Keyboard-first workflow optimized for the terminal (minimal flags, default editor integration, quick-add flow).
- Instant fuzzy search (Fuse.js) with ranking tuned for recent/most-used snippets.
- Safe run workflows: preview, dry-run, and run-with-confirmation; built-in sandbox options (e.g., run in a temporary shell, prompt to persist outputs).
- Portable, XDG-compliant storage with optional encrypted cloud sync (pro feature) to avoid vendor lock-in.
- Extensible: export/import (JSON), gist integration, and simple API for editor/IDE integration.

4) Tech stack
- Runtime: Node.js (LTS latest).
- CLI framework: Commander.js (lightweight) or oclif for future plugin support.
- Storage: JSON file store for MVP at $XDG_CONFIG_HOME/snipsdb.json and snippet files under $XDG_DATA_HOME/snipmgr/snippets/; SQLite drop-in later for scale.
- Search: Fuse.js for fuzzy text search and ranking.
- Execution: spawn child_process with user shell; use temporary files for multi-line snippets; rely on clear safety prompts.
- Optional sync: GitHub Gist API for backup and share; later add encrypted hosted sync.
- Tests: Jest for unit tests.

5) Architecture (high level)
- CLI entrypoint (bin/snip) parses commands and flags.
- Core modules:
  - storage.js — read/write JSON DB + manage snippet files
  - search.js — Fuse.js wrapper and ranking heuristics
  - commands/* — add, list, show, run, search, config
  - exec.js — safe execution helpers (preview, dry-run, run)
  - sync.js — gist sync adapter
  - config.js — XDG config handling and defaults
- Data model (snippet):
  - id: uuid
  - name: string
  - contentPath: string (file path)
  - language: string
  - tags: string[]
  - createdAt, updatedAt, lastUsedAt, usageCount
  - metadata: freeform

6) CLI UX and UI (summary — detailed in ui_ux.md)
- Minimal commands: add, list, show, search, run, edit, rm, export, import, config
- Default flows: snip add <name> opens $EDITOR; snip search "http" then press number to open or run; snip run <id> shows preview + confirm.
- Interactive mode: snip ui opens a simple TUI (later) that integrates fuzzy search and keybindings (j/k, enter to show, r to run, t to toggle tags filter, / to start new search)

7) User journey (developer day-to-day)
- Install via npm: npm install -g snip
- Configure editor: snip config set editor="code --wait"
- Add snippets as discovered during work: snip add "aws-login" --tags aws,auth
- Retrieve instantly while working: snip search "aws" -> select -> run (confirm) or copy to clipboard
- Share snippet: snip export --gist <id> or snip sync push

8) Monetization and roadmap for paid features
- Free: local-first core features (add, list, search, show, run, export/import)
- Paid (Pro): encrypted cloud sync, team/private sharing, usage analytics, advanced search across devices, snippet marketplace, priority support
- Business model: freemium with per-user/month sync tiers and team plans

9) Security and safety
- Never auto-run snippets without explicit confirmation.
- Optionally detect dangerous patterns (rm -rf, destructive SQL) and warn.
- Optional snippet encryption at rest for cloud sync.

10) Metrics and signals of success
- Daily active snippets used, time saved per snippet (self-reported), number of snippets added per week, retention after 7/30 days.

11) Roadmap (3-phase)
- Phase 1 (MVP): scaffold, add/list/search/show/run, JSON persistence, simple safety prompts
- Phase 2: TUI, SQLite storage, import/export, gist sync
- Phase 3: Encrypted cloud sync, team features, marketplace, IDE extensions

12) Immediate next steps
- Confirm Node.js runtime (done) and begin scaffolding: package.json, bin/snip entry, storage and add/list implementation.

Appendix: companion artifacts created in session folder: UI/UX, tech architecture, user journey, value proposition, and color scheme documents.

Progress:
- Scaffolded Node.js project and implemented MVP commands: add, list, search, show, run
- Added edit, rm, export, import commands
- Unit tests added and passing

Next: polish UX, add export/import tests, and implement gist sync for backups.

Progress update:
- Added first-run onboarding message and improved --help quickstart.
- Added GitHub Actions CI workflow to run tests on push/PR.
- Implemented optional SQLite storage backend in lib/storage.js (requires native better-sqlite3). To enable: set `useSqlite` true in config or set dbPath to a `.db`/`.sqlite` path and install better-sqlite3. Note: building better-sqlite3 may require a C++ toolchain and Node-compatible compiler (CI will handle this in workflow).


