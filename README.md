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
- To enable, set config useSqlite to true: `snip config set useSqlite true` or set dbPath to a .db file: `snip config set dbPath ~/.local/share/snip/snips.db`
- Install native dependency (optional): `npm install better-sqlite3` (may require build tools on some platforms).
- To migrate existing JSON snippets to SQLite run: `node lib/migrate_to_sqlite.js` after installing better-sqlite3.
- If better-sqlite3 is not installed and SQLite is requested, snip will fall back to the JSON DB and print a warning.
