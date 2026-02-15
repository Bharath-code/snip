# snip — CLI Snippet Manager

A lightweight, cross-platform CLI for saving, searching, sharing, and running reusable code and shell snippets.

Built as an opinionated MVP with a TUI for efficient snippet management, optional SQLite persistence, and GitHub Gist sync.

Highlights
- Fast add/list/search/run workflow for developer CLI snippets
- Optional SQLite backend with native (better-sqlite3) or WebAssembly (sql.js) fallback
- Sync snippets to/from GitHub Gists
- Interactive TUI with fuzzy search and keyboard-first navigation

Installation

Install locally via npm:

  npm install -g .

(For releases, install from npm when published.)

Quick start

Configure your editor (optional):

  snip config set editor "code --wait"

Add a snippet from stdin:

  echo 'docker run --rm -it -v "$PWD":/work -w /work ubuntu:24.04 bash' | snip add docker-run --lang sh --tags docker,run

List snippets:

  snip list

Search:

  snip search docker

Show a snippet:

  snip show docker-run

Run (dry-run preview):

  snip run docker-run --dry-run

Commands (MVP)
- snip add <name>
- snip list [--sort name|usage|recent]
- snip search <query>
- snip show <id|name>
- snip run <id|name>
- snip edit <id|name>
- snip rm <id|name>
- snip export [path]
- snip import <file>
- snip config get|set
- snip seed — reset local store and install example snippets
- snip sync push <id|name> — push to GitHub Gist
- snip sync pull <gistId> — import from a Gist
- snip ui — interactive TUI

Configuration

- Defaults follow $EDITOR and XDG directory conventions.
- Store a GitHub Gist token in SNIP_GIST_TOKEN for ephemeral usage (recommended):

  export SNIP_GIST_TOKEN=ghp_...

- Or persist with:

  snip config set gist_token <token>

Database

- Optional SQLite backend: enable with `snip config set useSqlite true` and set `dbPath` if desired.
- Recommended native driver: `npm install better-sqlite3` (requires platform build tools).
- Fallback: `sql.js` (WASM) for environments without native builds.
- A smoke test script validates sql.js create/persist/load behavior (`npm run smoke-sqljs`).

Packaging & Publishing

Ensure `package.json` includes a `bin` entry (e.g. `"bin": { "snip": "lib/cli.js" }`), bump the version, and publish with `npm publish`.

Contributing

Contributions are welcome. Please open issues for bugs and feature requests, and send pull requests with clear descriptions and tests where applicable. Follow the repository's contribution guidelines and code style.

License

This project is open source. See LICENSE for details.

Changelog

See CHANGELOG.md for notable changes.

