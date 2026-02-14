# Technical Architecture — CLI Snippet Manager (snip)

Overview
- Goal: small, maintainable Node.js codebase with clear separation between CLI parsing, storage, search, and execution.

Components
1) CLI entry (bin/snip)
   - Boots config, parses args with Commander, dispatches to command handlers.

2) Config module (lib/config.js)
   - Loads XDG-compliant config, provides get/set helpers, default values.

3) Storage module (lib/storage.js)
   - JSON DB format for MVP: { snippets: {id: {...}}, meta: {...} }
   - Snippet contents stored as files in data dir to avoid large JSON.
   - Atomic writes (write-temp-and-rename) to avoid corruption.

4) Search module (lib/search.js)
   - Builds Fuse index from snippet metadata and content summary.
   - Provides search(query, options) -> ranked results.

5) Command handlers (lib/commands/*.js)
   - add.js, list.js, show.js, run.js, search.js, config.js

6) Execution module (lib/exec.js)
   - Handles preview, dry-run, and real execution using spawn; captures exit code and output.

7) Sync adapter (lib/sync/gist.js)
   - Optional gist push/pull with token-based auth; sync mappings maintained in DB.

Data model (snippet)
- id: uuid
- name: string
- path (content file), language, tags[], createdAt, updatedAt, lastUsedAt, usageCount

Error handling and resilience
- Handle corrupted DB by creating backups and offering recovery.
- Provide clear error messages and non-zero exit codes for scripting.

Testing
- Unit tests for storage, search, and exec.
- Integration tests for CLI flows using child_process.spawn in Jest.

Packaging and distribution
- package.json with bin field "snip": "./bin/snip"
- Publish to npm and provide Homebrew formula later.

