# snip — Action Plan (Audit-Driven)

> **Source:** [docs/AUDIT.md](./AUDIT.md)  
> **Use:** Complete tasks in order within each category (Easy → Medium → Hard). Check off as you go.

---

## How to Use This Plan

- **Categories** match the audit sections (Performance, Code Quality, UX, etc.).
- **Complexity** per category: **Easy** → **Medium** → **Hard**.
- Do **one task at a time**; check the box when done.
- Must-fix / security items are marked **🔴**.

---

## 1. PERFORMANCE

### Easy
- [x] **1.1** Remove `mkdirp` — use `fs.mkdirSync(path, { recursive: true })` (Node 18+).
- [x] **1.2** Remove `uuid` — use `crypto.randomUUID()` (fallback already in storage.js).
- [x] **1.3** Remove `fs-extra` — replace 1–2 calls with native `fs`.
- [x] **1.4** Replace `readline-sync` with native `readline` (async) where used.

**Outcome:** ~900 kB lighter, 4 fewer deps.

### Medium
- [x] **1.5** Add Fuse index cache invalidation — only rebuild when snippet count or DB mtime changes (in `lib/search.js`).
- [x] **1.6** Lazy-load snippet content in `storage.js` — metadata-only for `list`/`search`; load content only for `show`/`run`/`exec`.

### Hard
- [ ] **1.7** Add in-process cache for `listSnippets()` so repeated commands in same process don’t reload full data every time.

---

## 2. CODE QUALITY & CRITICAL BUGS

### Easy
- [x] **2.1** 🔴 **Fix `--confirm` bypass** — In `run.js`, ensure `--confirm` only skips the "press Enter" prompt, never the danger check. Danger must always run.
- [x] **2.2** **`template.js`** — Replace `process.exit(1)` with `throw new Error(...)` so programmatic use can catch.
- [x] **2.3** Extract `lib/colors.js` — single place for chalk + fallback; replace copy-pasted color objects in `list.js`, `stats.js`, `run.js`, `show.js`.
- [ ] **2.4** Centralize `process.exit()` — move exit logic into `cli.js` where possible; commands should throw or return status.

### Medium
- [x] **2.5** 🔴 Add **file lock** (or single-writer) for JSON backend in `storage.js` so two concurrent `snip add` don’t corrupt the DB (e.g. lock file or mutex around read-modify-write).
- [x] **2.6** 🔴 Add `better-sqlite3` as **optional dependency** in `package.json` and document; add `snip doctor` check that suggests `npm install -g better-sqlite3` when SQLite is enabled but module missing.
- [ ] **2.7** Normalize error handling — all commands: errors to stderr, non-zero exit on failure, consistent behavior for scripting.
- [x] **2.8** Enforce `--no-color` / `NO_COLOR` everywhere — audit chalk usage and respect flag/env in all commands.

### Hard
- [ ] **2.9** Raise coverage — bring command-layer coverage up (add tests for add, run, grab, pipe, show, stats, alias, sync; aim 60%+ on critical paths).
- [ ] **2.10** Add tests for `lib/sync/gist.js` and SQLite/sql.js paths in `lib/storage.js`.
- [ ] **2.11** Expand `lib/safety.js` tests — cover all 14 danger patterns (currently 9).

---

## 3. UI/UX

### Easy
- [x] **3.1** **Terminal width** — In `list.js`, use `process.stdout.columns` for column widths instead of fixed 28/10/30/6.
- [x] **3.2** **First-run experience** — Surface existing first-run/onboarding message prominently (e.g. when no snippets and no config); hint to run `snip seed` or `snip doctor`.
- [x] **3.3** **Error messages** — For "Snippet not found", add next-step: e.g. "Did you mean X?" or "Try `snip search <term>`."
- [x] **3.4** **Gist errors** — On 401 from GitHub API, show: "Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT."

### Medium
- [x] **3.5** **`snip run` vs `snip exec`** — Clarify in docs and help text; consider merging or one-line explanation in `--help` and README.
- [x] **3.6** **Pager for long lists** — When `snip list` returns 50+ snippets, use a pager (e.g. `less`) or suggest TUI.
- [x] **3.7** TUI first-run — Show a tiny guide or overlay on first `snip ui` (e.g. keybindings, "? for help").

### Hard
- [ ] **3.8** Add inline help overlay in TUI (e.g. `?` key) with keybindings and confirm behavior.

---

## 4. DEVELOPER EXPERIENCE (DX)

### Easy
- [ ] **4.1** **`snip doctor`** — Add check for Ctrl+G widget installation; report and suggest setup if missing.
- [ ] **4.2** **`snip doctor`** — When SQLite is enabled but `better-sqlite3` is missing, say: "Install `npm install -g better-sqlite3` to enable SQLite."
- [ ] **4.3** Document **import/export schema** (e.g. in CONTRIBUTING or docs) so contributors can build tooling.
- [ ] **4.4** **`snip grab github:user/repo/path`** — Mention in `snip doctor` tips and README so it’s discoverable.
- [ ] **4.5** **`snip config`** — Add basic validation (type checking / allowed keys) instead of accepting any value.

### Medium
- [x] **4.6** **`snip init`** — Single guided wizard: choose editor → set up shell widget → seed example snippets → optional "open TUI". Target: zero to aha in ~60 seconds.
- [x] **4.7** **`snip last`** — Re-run last executed snippet (store last snippet id/name; simple persistence).
- [x] **4.8** **`snip stats --streak`** — Days in a row using snip (needs lightweight usage tracking).
- [x] **4.9** **CLI help** — One-line example in `--help` for each core command; align README examples with behavior.

### Hard
- [ ] **4.10** **`snip watch <name>`** — Re-run snippet on file edit (watch snippet file or DB change).
- [ ] **4.11** **CONTRIBUTING.md** — "Your first command in 10 minutes" + how to run tests/lint.

---

## 5. FEATURES (FIXES & GAPS)

### Easy
- [x] **5.1** **Gist conflict** — When pulling would overwrite local changes, warn and optionally show diff or ask for strategy (overwrite / merge / cancel).
- [x] **5.2** **`snip edit` (SQLite)** — Ensure edits persist when editor saves; handle abort (e.g. temp file → write back only on save).
- [x] **5.3** **`snip recent`** — Add test coverage; fix edge case on empty history.
- [x] **5.4** **`snip config` validation** — Reject invalid values and list allowed keys/types in help.

### Medium
- [x] **5.5** **Shell history import** — `snip import-history --last 30`: analyze recent shell history, find commands run 3+ times, suggest saving as snippets.
- [x] **5.6** **Natural language search** — Make description first-class in search (e.g. higher weight in Fuse options) so "find my docker cleanup command" works well.

### Hard
- [ ] **5.7** **Context-aware suggestions** — In dir with `package.json` → suggest npm snippets; with `Dockerfile` → suggest docker snippets (needs context detection + tagging or categories).

---

## 6. ROADMAP (v0.4.0 & BEYOND)

*These are larger efforts; treat as separate projects.*

### v0.4.0
- [ ] **6.1** All "Must Fix Now" and "Easy" items in sections 1–5 above.
- [ ] **6.2** Shell history import (5.5), `snip last` (4.7), `snip stats --streak` (4.8).
- [ ] **6.3** `snip init` (4.6), doctor widget check (4.1), coverage to 60%+ (2.9).

### Q2/Q3 (Growth)
- [ ] **6.4** Snippet packs / community library (`snip install docker-essentials`).
- [ ] **6.5** Team sync (e.g. shared `snip.yml` in repo).
- [ ] **6.6** VS Code (or Neovim) extension — save selection as snip, run from palette.
- [ ] **6.7** AI: `snip ai generate "..."` and/or `snip ai improve <name>`.
- [ ] **6.8** Semantic search over snippet library.

### Brand & Distribution
- [ ] **6.9** Investigate npm package name `snip` (or `@snip/cli`).
- [ ] **6.10** Animated asciinema/vhs demo in README.
- [ ] **6.11** GitHub Discussions enabled.
- [ ] **6.12** Product Hunt launch prep; 5 curated snippet packs as separate repos.

---

## 7. RECOMMENDED ORDER (ONE BY ONE)

If you want a single ordered list to tick off:

1. **2.1** Fix `--confirm` danger bypass 🔴  
2. **2.2** template.js throw instead of exit  
3. **1.1–1.4** Remove mkdirp, uuid, fs-extra, readline-sync  
4. **2.3** Extract lib/colors.js  
5. **2.6** better-sqlite3 optional dep + doctor  
6. **3.1** list.js use stdout.columns  
7. **3.2** First-run onboarding message  
8. **3.3** "Snippet not found" + next-step  
9. **3.4** Gist 401 message  
10. **4.1** doctor: widget check  
11. **4.2** doctor: better-sqlite3 message  
12. **4.6** snip init wizard  
13. **2.5** File lock for JSON storage  
14. **2.7** Normalize error handling  
15. **1.5** Fuse cache invalidation  
16. **1.6** Lazy-load content in storage  
17. **4.7** snip last  
18. **4.8** snip stats --streak  
19. **2.9** Raise coverage + command tests  
20. Then continue with remaining Medium/Hard and roadmap as needed.

---

*Last updated from AUDIT.md (2026-03-13).*
