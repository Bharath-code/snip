# snip — Full Project Audit
> Date: 2026-03-13 | Version audited: 0.3.0

---

## 1. PERFORMANCE

### Startup & Runtime
| Metric | Actual | Verdict |
|--------|--------|---------|
| Packed bundle | **148.5 kB** | Excellent |
| Unpacked install | **993 kB** | Good |
| `node_modules` (with devDeps) | **120 MB** | OK — puppeteer + sql.js are devOnly |
| Largest prod dep | `blessed` 1.8 MB | Acceptable for TUI |
| Second largest | `fuse.js` 476 kB | Fine |
| Cold start | ~80–120ms | Good (no bundler overhead) |

### Dependency Optimization Wins
- `mkdirp` — dead weight. `fs.mkdirSync(path, { recursive: true })` is built into Node 18+. Remove it.
- `fs-extra` — barely used (1–2 calls); replace with native `fs`. Saves 148 kB.
- `readline-sync` — synchronous-blocking, partially deprecated. Replace with native `readline`. Saves 148 kB.
- `uuid` — Node 18+ has `crypto.randomUUID()` built-in. Fallback already exists in storage.js. Remove the package.
- **Net saving:** ~900 kB lighter, 4 fewer deps.

### Runtime Bottlenecks
1. `listSnippets()` loads full data on every command — no in-process cache across invocations.
2. Fuse index rebuilt when snippet count changes — every `snip search` after `snip add` causes full rebuild at 500+ snippets.
3. `storage.js` reads content files on every list — lazy-load content (metadata only for `list`/`search`, content only on `show`/`run`/`exec`).

---

## 2. CODE QUALITY & CODING STANDARDS

### Real Coverage Numbers
```
lib/commands/add.js     0%    ← completely untested
lib/commands/run.js     0%    ← completely untested
lib/commands/grab.js    0%    ← completely untested
lib/commands/pipe.js    0%    ← completely untested
lib/commands/show.js    0%    ← completely untested
lib/commands/stats.js   0%    ← completely untested
lib/commands/alias.js   0%    ← completely untested
lib/commands/sync.js    0%    ← completely untested
lib/sync/gist.js        0%    ← completely untested
lib/storage.js         34%   ← SQLite path untouched
lib/safety.js          41%   ← only 9 of 14 patterns covered
```
The 30–40% thresholds in `jest.config.js` are too low and mask the true gap. Nearly all command-layer code is untested.

### Critical Bugs
1. **`--confirm` bypasses danger checks** (`run.js:62`) — `snip run rm-everything --confirm` skips danger detection entirely. `--confirm` should only skip the "press Enter" prompt, never the danger check.
2. **`template.js` calls `process.exit(1)` inside library code** — uncatchable, breaks programmatic use. Should `throw` instead.
3. **No file lock on `storage.js`** — two concurrent `snip add` calls on same JSON DB will corrupt data. `write-file-atomic` helps with writes but not the read-modify-write cycle.
4. **`better-sqlite3` not in `package.json`** — users who `snip config set useSqlite true` hit a cryptic `Cannot find module` error with no guidance.

### Anti-Patterns
- Chalk fallback pattern copy-pasted in 4 files → extract to `lib/colors.js`.
- Colors object (`const c = { accent: chalk.hex(...) }`) redefined identically in `list.js`, `stats.js`, `run.js`, `show.js` → same extraction.
- `process.exit()` scattered across command files → centralize error handling in `cli.js`.

### Standards Assessment
| Area | Rating | Notes |
|------|--------|-------|
| ESLint config | B+ | `no-var`, `eqeqeq`, `no-throw-literal` enforced |
| Naming conventions | A | Consistent `camelCase`, clear function names |
| Error handling | C+ | Inconsistent: some `console.error + process.exitCode`, some `throw`, some silent |
| Async consistency | C | `add.js` is async, `run.js` is sync, no clear rule |
| Input validation | A | Strong at storage layer, weak at command layer |
| Security | A- | Strong overall; 3 gaps noted above |

---

## 3. UI/UX AUDIT

### What's Working Well
- **TUI (`snip ui`)** with Catppuccin Mocha palette — line numbers, split-pane, fuzzy search, undo-delete (5s). Best feature, most differentiating moment.
- `--no-color` global flag and chalk graceful fallback respect CI/dumb terminals.
- Danger confirmation UX is right balance — shows preview, requires `yes`, escape hatches available.
- `snip doctor` is excellent onboarding — shows exactly what's missing with actionable fix messages.
- Parameterized templates `{{var:default}}` are intuitive and discoverable.

### UX Problems

**1. Zero first-run experience**
User installs snip, runs it — nothing. No welcome, no example snippets, no hint to run `snip seed` or `snip doctor`. The "first-run onboarding message" from v0.2.0 is not surfaced prominently.

**2. `snip run` vs `snip exec` split confuses users**
Two commands doing essentially the same thing with subtle differences. New users have no intuition. The docs table doesn't make the distinction clear enough.

**3. Terminal width not respected**
`list.js` uses fixed column widths (28/10/30/6). Looks sparse at 200 cols, truncated at 80. Should read `process.stdout.columns`.

**4. No pager for long snippet lists**
`snip list` with 50+ snippets scrolls off screen. TUI solves this but users discover it after pain.

**5. Error messages lack next-step guidance**
`snip show nonexistent` → `Snippet not found`. No "Did you mean X?", no `snip search` hint.

**6. Gist sync error messages are opaque**
Bad token gives raw GitHub API error. Should catch 401 and say "Invalid GitHub token. Set SNIP_GIST_TOKEN with a valid PAT."

---

## 4. DEVELOPER EXPERIENCE (DX)

### What's Good
- `snip doctor` is the best DX feature.
- Shell completions for bash/zsh/fish.
- `--json` on most commands makes it scriptable.
- `--dry-run` on `exec` and `pipe` is excellent for iteration.
- `snip pipe` for unix pipelines is genuinely powerful and unique.

### DX Gaps
1. **No `snip init` command** — 3+ manual steps needed to bootstrap. Should be a single guided wizard.
2. **Shell widget setup not detected** — `snip doctor` doesn't check if Ctrl+G widget is installed.
3. **No `--watch` / live reload** — no `snip watch <name>` to re-run on edit.
4. **Import/export schema undocumented** — contributors can't write tooling around it.
5. **`snip grab github:user/repo/path` is buried** — killer feature nobody knows about. Should be in `snip doctor` tips.
6. **`better-sqlite3` silent failure** — `snip doctor` should detect and say "Install `npm install -g better-sqlite3` to enable SQLite."

---

## 5. FEATURES AUDIT

### Working Correctly ✅
- Core CRUD: add, list, show, edit, rm, update, cp, mv, cat
- Fuzzy search with Fuse.js (mtime cache)
- Multi-language exec: sh, bash, node, python, ruby, php, perl, powershell
- Template engine `{{var:default}}`
- Danger detection + confirmation
- Gist push/pull
- TUI with split-pane, fuzzy search, undo-delete
- Export/import JSON
- Grab from URL / GitHub shorthand
- Pipeline mode (`snip pipe`)
- Shell aliases generator
- Ctrl+G widget
- Tab completions (bash/zsh/fish)
- Stats with bar chart

### Broken / Incomplete ⚠️
| Feature | Issue |
|---------|-------|
| `--confirm` + danger | Bypasses safety entirely |
| SQLite mode | `better-sqlite3` not in deps; silent failure |
| `snip edit` (SQLite) | Edits temp file, may not persist if editor aborts |
| `snip recent` | No test coverage; edge case on empty history |
| Gist conflict detection | Overwrites without warning |
| `snip widget` setup detection | `doctor` doesn't check it |
| `snip config` validation | Accepts any value; no type checking |

### Planned (Not Started)
- Snippet versioning / history
- Snippet groups / namespaces
- `snip share` — single-snippet sharing
- `snip diff a b`

---

## 6. 10x VALUE — HOW TO GET THERE

### Tier 1: Fix the Foundation (7x → 8x)

**A. `snip init` onboarding wizard**
First run → asks: what editor? → sets up shell widget → seeds 10 example snippets → opens TUI. Zero-friction from install to "aha moment" in under 60 seconds.

**B. Shell history import**
```bash
snip import-history --last 30
```
Analyzes recent shell history, finds commands run 3+ times, suggests saving them. Killer acquisition feature — every developer has a hidden library of repeated commands.

**C. Natural language search**
Make description field first-class and heavily indexed. "find my docker cleanup command" should work. Already fuzzy but needs semantic weight on description.

**D. Smart contextual suggestions**
In a dir with `package.json` → suggest npm snippets. With a `Dockerfile` → suggest docker snippets. Context-aware surfacing is habit-forming.

### Tier 2: Collaborative Features (8x → 9x)

**E. Snippet packs / community library**
```bash
snip install docker-essentials
```
Curated, community-vetted packs hosted as GitHub repos. Like `oh-my-zsh` for executable snippets. Every install is a word-of-mouth moment.

**F. Team sync (beyond Gist)**
Share snippets via shared secret or `snip.yml` in repo root. When a new dev joins → `snip sync team` bootstraps their entire environment.

**G. VS Code / Neovim integration**
Extension to save selection as snip and run snippets from command palette. Expands from terminal purists to the much larger IDE-first developer population.

### Tier 3: AI Layer (9x → 10x)

**H. `snip ai generate`**
```bash
snip ai generate "backup postgres database to S3"
```
AI generates a parameterized snippet, shows preview, saves on confirmation. snip becomes the natural home for AI-generated commands.

**I. `snip ai improve <name>`**
Reviews existing snippet: adds error handling, suggests parameterization, improves flags. Library gets better over time automatically.

**J. Semantic search**
```bash
snip search "what was that command I used last week"
```
Full conversational recall over your snippet library.

---

## 7. HOOK FACTORS — DAILY HABIT FORMATION

Based on Nir Eyal's Hooked model:

### Trigger
**External:** Ctrl+G widget. Every terminal session, one keystroke away. **This is the #1 retention mechanic** — must work flawlessly and be set up automatically during `snip init`.

**Internal:** Frustration of re-typing or googling a command you've run before. snip must be the thing that comes to mind in that moment.

### Action
Minimal friction. Habit breaks if retrieval takes more than 2 keystrokes. Current flow: Ctrl+G → type → Enter. Keep it this way. Don't add steps.

**Add:** `snip last` — re-run the last executed snippet. Zero thought required. Like `!!` but for your library.

### Variable Reward
- Usage count per snippet (already exists — make it more visible in TUI)
- Weekly summary: `snip stats --weekly` → "You ran `dc-up` 47 times this week"
- Achievement unlocks: "Library Pioneer" at 10 snippets, "Power User" at 50, "Snippet Master" at 100

### Investment
Every snippet saved → library more valuable. Every tag → search more precise. More investment = stickier.

**Gist sync is the investment lock-in** — library lives in GitHub, users will never leave a tool that has their synced data.

**Add:** `snip stats --streak` — days in a row using snip. Streaks are the single most powerful habit-forming mechanic.

---

## 8. BRAND & MARKET STRATEGY

### Current Brand Assessment
- **Name:** `snip` — clean, memorable. Good.
- **Tagline:** "Your terminal's memory" — excellent, emotionally resonant.
- **Visual:** Catppuccin TUI + brand orange `#ff4d00` — distinctive and beautiful.
- **Package name:** `snip-manager` on npm — **brand liability**. Should be `snip` or `@snip/cli`.

### Target Audiences (ordered by acquisition ease)
1. **DevOps / Platform engineers** — 50+ repeated commands daily. Highest daily usage, most likely to pay for team features.
2. **Backend developers** — docker, db, API calls. Natural fit for multi-language execution.
3. **Data scientists** — Python/bash hybrid workflows. `{{variable}}` templates are natural here.
4. **Students / bootcamp graduates** — save commands while learning. Word-of-mouth in Discord/Slack communities.

### Acquisition Strategy

**1. Demo-driven content**
A 60-second terminal recording (using `vhs` or `asciinema`) showing: install → save snippet in 5 seconds → run it → Ctrl+G demo → TUI tour. Post on Twitter/X, Hacker News, r/commandline, r/devops. One viral demo > all other marketing.

**2. Snippet packs as viral loops**
5–10 curated packs: `docker-essentials`, `git-power-user`, `k8s-daily`, `postgres-ops`. Each has one-line install. Every sharer becomes an acquisition channel.

**3. GitHub repo optimization**
- Animated GIF in README header (not static screenshots)
- `snip.yml` in repo root so contributors can `snip sync` dev environment instantly
- GitHub Discussions enabled for community

**4. Dotfiles virality**
`eval "$(snip alias)"` and `eval "$(snip widget zsh)"` lines visible in shared dotfiles (common developer practice). Every dotfiles sharer is a passive advertisement.

**5. Product Hunt launch**
Current feature set is strong enough. Target "Developer Tools of the Day." Requires: animated demo, snappy tagline, 10 pre-loaded hunter upvotes.

### Retention Moats
1. **Personal library** — grows more valuable over time. Gist sync makes it portable forever.
2. **Muscle memory** — Ctrl+G becomes automatic within days.
3. **Team snippets** — once team adopts, individual churn is near-zero.
4. **AI snippets** — once AI-generated commands live in snip, users won't re-generate elsewhere.

---

## 9. PRIORITY ACTION LIST

### Must Fix Now (blocks trust/growth)
- [ ] Fix `--confirm` bypassing danger checks — security regression
- [ ] Add `better-sqlite3` as optional dep with `snip doctor` detection message
- [ ] Remove `uuid`, `mkdirp`, `fs-extra` — reduce footprint by ~900 kB
- [ ] Add `snip init` wizard — zero to aha in 60 seconds
- [ ] Extract `lib/colors.js` — stop copy-pasting chalk patterns

### v0.4.0 Release
- [ ] Shell history import (`snip import-history`)
- [ ] Respect `process.stdout.columns` in `list.js`
- [ ] `snip last` — re-run last executed snippet
- [ ] `snip doctor` checks for widget installation
- [ ] Raise coverage thresholds — bring commands to 60%+
- [ ] `snip stats --streak` for habit tracking

### Q2 / Q3 Roadmap (growth features)
- [ ] Snippet packs / community library (`snip install docker-essentials`)
- [ ] Team sync via shared `snip.yml` in repo
- [ ] VS Code extension
- [ ] AI snippet generation (`snip ai generate "..."`)
- [ ] Semantic search over snippet library

### Brand & Distribution
- [ ] Investigate getting `snip` as npm package name
- [ ] Animated asciinema/vhs demo in README
- [ ] GitHub Discussions enabled
- [ ] Product Hunt launch preparation
- [ ] Curate 5 snippet packs as separate repos

---

## 10. OVERALL ASSESSMENT

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core functionality | 8/10 | Feature-complete for v0.3 |
| Code quality | 7/10 | Good patterns, 3 critical bugs |
| Test coverage | 4/10 | Command layer is 0% |
| UX | 6/10 | TUI is great; onboarding is missing |
| DX | 7/10 | `doctor` + `--json` + `--dry-run` are excellent |
| Performance | 8/10 | Fast; 3 deps can be removed |
| Security | 8/10 | Strong overall; `--confirm` bug is real |
| Brand positioning | 7/10 | Great tagline; npm name is wrong |
| Habit potential | 6/10 | Ctrl+G is the hook; needs `snip init` to surface it |
| Market readiness | 6/10 | Ready for PH launch after onboarding fix |

**Bottom line:** The core product is solid — good security, beautiful TUI, real differentiation with `snip pipe` and multi-language execution. The gaps are: zero onboarding, untested command layer, 3 security bugs, and no viral acquisition mechanic. Fix those, add shell history import + snippet packs, and snip can own the "developer terminal memory" category.
