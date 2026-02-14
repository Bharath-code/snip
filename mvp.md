# MVP Breakdown — CLI Snippet Manager (snip)

Date: 2026-02-14

Goal: Deliver an opinionated, minimal product that demonstrates core value (capture, recall, safe-run) in two weeks of focused work.

1) MVP Scope (Must-have features)
- snip add <name> [--lang] [--tags]
  - Implementation: open $EDITOR or accept stdin; write content to $DATA/snippets/<id>.txt and update DB JSON.
  - Acceptance: snippet persists and appears in list and search.

- snip list [--tag/-t] [--lang] [--sort]
  - Implementation: read DB and render compact table; support simple filters.
  - Acceptance: filters work and output is colorized by default.

- snip search <query>
  - Implementation: build Fuse.js index from name, tags, and first 200 chars of content; return top N results with score.
  - Acceptance: relevant results returned for sample queries in tests.

- snip show <id|name>
  - Implementation: display content via $PAGER; support --edit to open editor.
  - Acceptance: content displays and edit persists changes.

- snip run <id|name> [--dry-run] [--confirm]
  - Implementation: show preview, require confirmation, then spawn user's default shell to execute snippet; capture exit code and output.
  - Acceptance: snippet executes and usageCount and lastUsedAt update in DB.

- snip config get/set
  - Implementation: simple key-value config persisted in XDG config JSON.
  - Acceptance: config values affect behavior (editor, confirm_run, storage path).

2) Architecture & Files to implement (MVP)
- package.json (bin mapping)
- bin/snip (CLI entry)
- lib/config.js (XDG config helpers)
- lib/storage.js (JSON DB + content file helpers)
- lib/search.js (Fuse.js wrapper)
- lib/commands/{add,list,search,show,run,config}.js
- lib/exec.js (preview + spawn)
- tests/ (jest tests for storage, search, and run dry-run)

3) Implementation plan (day-by-day, 10 work-days)
Day 1: scaffold project, package.json, bin script, basic config and storage module
Day 2: implement add command and list; basic tests for storage
Day 3: implement search with Fuse.js and tests; integrate list with search
Day 4: implement show and edit flow; pager integration
Day 5: implement run (dry-run + confirm), exec wrapper and tests
Day 6: polish CLI UX, colors, and config; add helpful --help text
Day 7: write integration tests for core flows; fix bugs
Day 8: write README and getting-started; package locally; smoke test
Day 9: user testing with 2-3 devs; iterate on prompts and defaults
Day 10: finalize, create npm package draft and release notes

4) Acceptance tests and checklist
- Unit: storage reads/writes and atomicity; search returns expected results; exec dry-run does not execute.
- Integration: add->list->search->show->run (with dry-run and confirm) works in sequence.
- Usability: first-run onboarding displays editor suggestion and asks to add sample snippet.

5) Post-MVP quick wins (Should-have finishing tasks)
- export/import JSON; edit and remove commands; gist push/pull basic adapter.

6) Risks & fallbacks during MVP
- If Fuse.js tuning takes time, provide basic substring search as fallback.
- If spawn exec has cross-shell issues, default to writing snippet to a temp file and running via sh -c "bash temp".

7) Deliverables on MVP completion
- Working CLI installed locally (npm link), README, automated tests, sample snippet pack, and a short demo script to showcase flows.

(End MVP)
