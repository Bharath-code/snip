## snip — Execution Plan & Task Breakdown

**Goal:** Turn the current product, strategy, and GTM drafts into a concrete, actionable backlog.

### 1. Core Product & Quality (Weeks 0–2)

- **P1 – Implement search index caching**
  - Scope: Cache Fuse.js index in `lib/search.js` with invalidation on add/edit/rm or DB mtime.
  - Outcome: Search remains fast with 1,000+ snippets.
  - Status: TODO

- **P1 – Harden import/export security**
  - Scope: Validate imported JSON (schema + max size + max snippet count); add tests in `__tests__/import_validation.test.js`.
  - Outcome: Safer `snip import` that resists malformed or huge payloads.
  - Status: TODO

- **P1 – Normalize error handling & exit codes**
  - Scope: Ensure all commands send errors to stderr, return non‑zero exit codes on failure, and behave consistently for scripting.
  - Outcome: Predictable CLI behavior in scripts and automations.
  - Status: TODO

- **P2 – Consistent color / --no-color behavior**
  - Scope: Audit all commands for chalk usage; ensure `--no-color` or `NO_COLOR` env is respected everywhere.
  - Outcome: Better UX in both colorful and plain terminals.
  - Status: TODO

- **P2 – Expand test coverage**
  - Scope: Add focused tests for config, sync/gist path, and SQLite/sql.js flows.
  - Outcome: Higher confidence when changing storage/sync code.
  - Status: TODO

### 2. UX & Developer Experience (Weeks 1–3)

- **P1 – Tidy CLI help & examples**
  - Scope: Add one‑line example to `--help` for each core command; ensure README examples match actual behavior.
  - Outcome: Faster onboarding for new users.
  - Status: TODO

- **P2 – TUI usability polish**
  - Scope: Add inline help overlay (`?`), confirm keybindings, and make first‑run of `snip ui` show a tiny guide.
  - Outcome: Discoverable, friendly TUI for first‑time users.
  - Status: TODO

- **P2 – Contributor experience**
  - Scope: In `CONTRIBUTING.md`, add a “your first command in 10 minutes” section and clarify how to run tests/linters.
  - Outcome: Lower friction for OSS contributors.
  - Status: TODO

### 3. Go‑to‑Market & Growth (Weeks 0–4)

- **P1 – Launch wave 1 (HN + Reddit + Twitter/X)**
  - Scope: Execute `docs/GTM_PLAYBOOK.md` Tier 1 actions: Show HN, 2–3 targeted subreddit posts (staggered), launch thread on Twitter/X.
  - Outcome: First meaningful wave of users, GitHub stars, and feedback.
  - Status: TODO

- **P1 – Assets & demos**
  - Scope: Produce short GIF/video demos (install → add → search → run → ui → pipe) and embed in README + website.
  - Outcome: Higher conversion on GitHub/npm/landing page.
  - Status: TODO

- **P2 – Content pieces**
  - Scope: Publish 2–3 blog posts as outlined in `docs/GTM_PLAYBOOK.md` (aliases replacement, dangerous command detection, TUI with blessed).
  - Outcome: Steady organic discovery via Dev.to/Hashnode.
  - Status: TODO

- **P2 – Awesome lists & ecosystems**
  - Scope: Submit to `awesome-cli-apps`, `awesome-shell`, `awesome-nodejs`; explore shell plugin ecosystems (oh‑my‑zsh/fisher).
  - Outcome: Long‑tail discoverability for terminal‑native users.
  - Status: TODO

### 4. Monetization & Pro/Team Exploration (Weeks 4–12)

- **P1 – Shared library design**
  - Scope: Define data model and flows for team/shared snippet libraries (namespaces, access control, sync format).
  - Outcome: Clear spec for the first Team/Enterprise feature set.
  - Status: TODO

- **P1 – AI‑assisted recall prototype**
  - Scope: Design and prototype `snip ai "<natural language description>"` that searches *your* snippets (local embeddings or simple semantic search to start).
  - Outcome: Validated “AI on top of your vault” experience for Pro tier.
  - Status: TODO

- **P2 – Cloud sync/hosting spike**
  - Scope: High‑level design for encrypted cloud sync (service boundaries, auth, minimal API); decide on self‑hosted vs managed first.
  - Outcome: Architecture draft to evaluate implementation effort and cost.
  - Status: TODO

### 5. Metrics & Feedback Loops (Ongoing)

- **P1 – Define metrics & manual tracking**
  - Scope: Use existing external signals (GitHub stars, npm downloads) plus lightweight, privacy‑respecting in‑tool metrics if added later (opt‑in).
  - Outcome: Simple dashboard/section in `docs/STRATEGY.md` to review progress monthly.
  - Status: TODO

- **P2 – Structured user feedback**
  - Scope: Add issue templates + a short survey link in README for early users (what commands they save, biggest missing feature).
  - Outcome: Qualitative input to prioritize Team/Pro features.
  - Status: TODO

