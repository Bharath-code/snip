# snip — CLI Snippet Manager (MVP)

Install locally:

  npm install -g .

Quick start:
- Set editor (optional):
    snip config set editor "code --wait"
- Add a snippet from stdin (example):
    echo 'docker run --rm -it -v "$PWD":/work -w /work ubuntu:24.04 bash' | snip add docker-run --lang sh --tags docker,run
- List snippets:
    snip list
- Search snippets:
    snip search docker
- Show snippet:
    snip show docker-run
- Preview run (dry-run):
    snip run docker-run --dry-run
- Run snippet:
    snip run docker-run

Example snippets to save (use `snip add`):
1) git-clean-merged — tags: git,cleanup — sh
   git branch --merged main | egrep -v "(^\\*|main|master)" | xargs -r git branch -d

2) docker-run-shell — tags: docker,run — sh
   docker run --rm -it --network host -v "$PWD":/work -w /work ubuntu:24.04 bash

3) serve-dir-http — tags: http,dev — sh
   python3 -m http.server 8000

Implemented MVP commands:
- snip add <name>
- snip list
- snip search <query>
- snip show <id|name>
- snip run <id|name>
- snip edit <id|name>
- snip rm <id|name>
- snip export [path]
- snip import <file>
- snip config get|set
- snip sync push <id|name> (push snippet to GitHub Gist)
- snip sync pull <gistId> (import files from a gist)

Config defaults come from $EDITOR and XDG dirs.

SQLite backend (optional):
- To enable: `snip config set useSqlite true` or set dbPath to a .db file: `snip config set dbPath ~/.local/share/snip/snips.db`
- Native driver (recommended for performance): `npm install better-sqlite3` — this may require platform build tools on some systems.
- Portable fallback: `sql.js` (install with `npm install sql.js`). If `better-sqlite3` is not available, snip will attempt to use `sql.js` and persist the database file by exporting the wasm-backed DB; this enables use on CI, macOS/Linux without native build tooling, and lightweight environments.
- Local smoke test: run `npm run smoke-sqljs` to execute `scripts/sqljs-smoke.js` which validates create/persist/load across the js-wasm path.
- CI: the included `.github/workflows/ci-matrix.yml` validates both native and sql.js paths (matrix jobs and a dedicated sql.js smoke job).

Packaging & publishing
- Ensure `package.json` contains a `bin` entry (for example: `"bin": { "snip": "lib/cli.js" }`), update the `version`, and publish with `npm publish` (CI-based publishing requires an `NPM_TOKEN` secret).
- A sample GitHub Actions publish workflow is included; configure `NPM_TOKEN` in repository secrets to enable automatic releases from CI.

Changelog
- See `CHANGELOG.md` for recent notable changes including the sql.js fallback, CI matrix, and smoke test.
