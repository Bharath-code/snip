# snip — Project Analysis

**Scope:** CLI Snippet Manager (MVP + post-MVP).  
**Reviewed:** Features done vs remaining, performance, security, UI/UX.

---

## 1. What’s Done

### Core MVP (from mvp.md)

| Feature | Status | Notes |
|--------|--------|------|
| `snip add <name>` (stdin + editor) | ✅ | Works; editor flow and `--lang` / `--tags` supported |
| `snip list` (with -t, --lang) | ✅ | Filter by tag/lang; no `--sort` in CLI |
| `snip search <query>` | ✅ | Fuse.js fuzzy search over name, tags, content (first 1000 chars) |
| `snip show <id\|name>` | ✅ | Prints content; `--edit` opens editor (broken with SQLite, see below) |
| `snip run <id\|name>` | ✅ | Preview, confirm, dry-run, danger detection; `--confirm` exposed for override |
| `snip config get/set` | ✅ | XDG config; editor, confirmRun, defaultShell, dbPath, gist_token, etc. |

### Post-MVP (from mvp.md “quick wins”)

| Feature | Status | Notes |
|--------|--------|------|
| Export/import JSON | ✅ | `snip export [path]`, `snip import <file>` |
| Edit/remove | ✅ | `snip edit`, `snip rm` (both broken with SQLite backend) |
| Gist push/pull | ✅ | `snip sync push <id>`, `snip sync pull <gistId>` (push/pull broken with SQLite) |

### Storage & infra

- **Dual storage:** JSON file DB + optional SQLite (better-sqlite3 or sql.js).
- **Config:** XDG-based (`~/.config/snip/config.json`, `~/.local/share/snip`).
- **Safety:** `lib/safety.js` blocks a set of dangerous patterns; run shows preview and respects `confirmRun`.
- **CI:** GitHub Actions matrix (native + sql.js), smoke test, publish workflow.

---

## 2. What’s Remaining (vs plan/mvp)

- **List:** MVP mentions `--sort`; not implemented (e.g. by date, name, usage).
- **Run:** Language-aware execution: everything is run as `snippet.sh` with `sh`; no `python`/`node` etc. by extension.
- **Roadmap:** TUI (`snip ui`), encrypted sync, team/marketplace (out of current scope).
- **Tests:** Test isolation is in place (temp XDG dirs); no dedicated tests for sync, config, or SQLite path; safety tests are minimal.

---

## 3. Performance

- **Search:** `lib/search.js` builds a new Fuse index on every `search` call (`buildIndex()` → `listSnippets()` + `readSnippetContent()` for each). Fine for dozens of snippets; with hundreds, consider caching the index or invalidating on add/edit/rm.
- **List:** Loads all snippets each time; acceptable for local JSON/SQLite at typical scale.
- **SQLite sql.js:** Full DB is read and written to disk on each persist; large DBs could feel slow. better-sqlite3 is preferred when native deps are acceptable.

**Suggestions:** Cache Fuse index with file mtime or “dirty” flag; optional `--limit` on `snip list` and `snip search`.

---

## 4. Security

- **Gist token:** **Implemented:** `SNIP_GIST_TOKEN` env var is supported and overrides config; README documents preferring the env var so the token need not be stored on disk. Config-file fallback remains for convenience.
- **Run safety:** Dangerous-pattern check and `confirmRun` are good. **Implemented:** `--confirm` is in the CLI so the override warning is valid.
- **Execution:** Snippets run in a temp dir as `snippet.sh` with user’s `SHELL`. No sandbox; user is responsible for content. Appropriate for a dev tool; optional: add “only run snippets you trust” to README.
- **Import:** No validation of imported JSON (e.g. path traversal in names, huge payloads). Low risk for local use; optional schema/size limits would harden it.

---

## 5. UI & UX (CLI)

- **First run:** Helpful welcome and quick start when no DB exists. Note: first-run check uses `cfg.dbPath`; if SQLite is enabled and only `sqlitePath` is set, welcome might show even when SQLite DB exists (minor).
- **Consistency:** Some commands use `console.error` for errors, others may mix; standardizing on stderr for errors and exit codes improves scriptability.
- **Edit with SQLite:** **Fixed:** edit and show --edit use a temp file and `updateSnippetContent` when `s.path` is null.
- **Run flow:** Preview → confirm → run is clear. Danger warning is good; `--confirm` override is implemented.
- **Output:** No chalk/colors in the files inspected; README mentions “colorized by default” for list — if not implemented, either add or update README.
- **Help:** `--help` and onboarding text are clear; adding one-line examples per command would help.

---

## 6. Critical Bugs (SQLite backend) — FIXED

When **SQLite is enabled**, the following were broken and have been fixed in this pass:

1. **Sync (gist.js):** Now uses `storage.setSnippetOrigin(id, origin)` so push/pull work with both JSON and SQLite.
2. **Edit (edit.js):** When `s.path` is null (SQLite), writes content to a temp file, opens editor, then calls `storage.updateSnippetContent(s.id, newContent)`.
3. **Rm (rm.js):** Now uses `storage.deleteSnippetById(s.id)` so removal works for both backends.
4. **Show --edit (show.js):** Same temp-file + `updateSnippetContent` flow when `s.path` is null; when path exists, calls `updateSnippetUpdatedAt(s.id)` after edit.

New storage helpers: `updateSnippetContent`, `updateSnippetUpdatedAt`, `deleteSnippetById`, `setSnippetOrigin`. sql.js path: `persist()` is called after inserts/updates so in-memory changes are written to disk.

---

## 7. Other Issues

- **import.js:** Fixed: was `s.content || s.content || ''`, now `s.content || ''`.
- **package.json:** `"main": "lib/cli.js"`; entrypoint is `bin/snip` → `../lib/cli`. Fine for CLI; main is only for programmatic use if any.
- **exec.js:** Always writes `snippet.sh` and runs with `sh`; snippet `language` is ignored at run time.

---

## 8. Summary

| Area | Verdict |
|------|--------|
| **Features** | MVP + post-MVP done; remaining: `--sort`, language-aware run. |
| **Performance** | OK for small/medium snippet sets; search re-indexes every time. Optional: cache index, `--limit`. |
| **Security** | `SNIP_GIST_TOKEN` and `--confirm` implemented; token storage documented in README. |
| **UI/UX** | Good first-run and run flow; SQLite edit/rm/show/sync fixed. Optional: first-run DB check, stderr/colors. |
| **Correctness** | SQLite path and import typo fixed; tests isolated via temp XDG dirs. |

**Recommended next steps (implementation status):**  
1. ~~Expose `--confirm` on `snip run`.~~ **Done.**  
2. ~~Fix SQLite compatibility for sync, edit, rm, show --edit.~~ **Done.**  
3. ~~Support `SNIP_GIST_TOKEN` env var and document token storage.~~ **Done.**  
4. ~~Add test isolation (temp config/DB dir).~~ **Done.** (Dedicated tests for sync and SQLite path not added yet.)  
5. Optionally: cache search index; add `--sort` to list; add tests for sync and SQLite.
