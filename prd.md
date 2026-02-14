# PRD — CLI Snippet Manager (snip)

Date: 2026-02-14

## 1. Purpose
Provide a frictionless, keyboard-first CLI tool for developers to capture, organize, search, preview, share, and safely execute small code snippets and terminal commands.

## 2. Objectives & Success Metrics
- Objective: Reduce time to reuse commonly used commands/snippets by 50% for a solo developer.
- Metrics: daily snippet uses, snippets added per week, retention at 7/30 days, average time from search->run, NPS from onboarding survey.

## 3. Target Users
- Primary: Solo developers who live in the terminal and reuse small utilities and commands.
- Secondary: Small teams wanting shared snippet packs (future feature).

## 4. Key user problems
- Hard to find previously used ad-hoc commands in shell history.
- Context switching to notes or web (gists) slows work.
- Unsafe to run remembered commands without preview.

## 5. Core Features (Functional Requirements)
Must-have (MVP):
- Add snippet (snip add): opens editor or accepts stdin; metadata: name, language, tags.
- List snippets (snip list): filter by tag/lang and sort by usage/recent.
- Search snippets (snip search): fuzzy search across name, tags, content with ranked results.
- Show snippet (snip show): display content with pager and metadata.
- Run snippet (snip run): preview + confirm + execute in user shell; update usage metrics.
- Config (snip config): set editor, storage path, default shell, confirm_run.

Should-have (post-MVP):
- Export/import JSON, gist push/pull sync, edit/remove snippet, copy to clipboard, dry-run.

Could-have (future):
- TUI interactive mode, SQLite storage, encrypted cloud sync, team sharing and marketplace.

## 6. Non-functional requirements
- Cross-platform: macOS, Linux, (Windows via WSL initially).
- Fast: search results under 100ms for 1k snippets.
- Reliable: atomic writes and DB backups.
- Secure: explicit run confirmations and optional dangerous-command detection.

## 7. Data model
Snippet:
- id (uuid), name, path (content file), language, tags[], createdAt, updatedAt, lastUsedAt, usageCount, metadata
DB:
- JSON file for MVP; snippet contents saved as files; later option: SQLite.

## 8. UX constraints
- Keyboard-first, minimal flags, obey $EDITOR and XDG dirs, colorized output with --no-color option.

## 9. Launch criteria
- All MVP commands implemented and covered by unit/integration tests.
- Basic README, install instructions, and one example snippet pack.
- Usability tested with at least 3 developers (qualitative feedback).

## 10. Risks & mitigations
- Risk: Users distrust running saved snippets. Mitigation: strong preview/confirm, detect destructive patterns.
- Risk: Feature bloat slows adoption. Mitigation: keep MVP minimal, iterate with user feedback.

## 11. Dependencies
- Node.js (LTS), Commander.js, Fuse.js, Jest (tests), optional Github Gist API for sync.

## 12. Acceptance criteria (MVP)
- snip add, list, search, show, run, config work end-to-end with JSON persistence.
- Running a snippet requires a visible preview and explicit confirmation unless user disables the prompt in config.
- Search returns expected matches for simple queries (tests verify ranking behavior).

---

(End PRD)
