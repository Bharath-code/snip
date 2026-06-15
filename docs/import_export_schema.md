# Import / Export Schema

For tooling, scripters, and contributors building integrations with `snip`.

---

## Export format (`snip export [file]`)

Outputs a JSON object with this shape:

```json
{
  "exportedAt": "2026-03-14T12:00:00.000Z",
  "snippets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "docker-cleanup",
      "language": "bash",
      "tags": ["docker", "ops", "cleanup"],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-15T08:30:00.000Z",
      "content": "#!/bin/bash\ndocker system prune -af --volumes\n"
    }
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exportedAt` | string (ISO 8601) | yes | Timestamp when the export was run |
| `snippets` | array of objects | yes | List of exported snippets |

### Snippet object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID v4) | yes | Unique identifier. Auto-generated if not provided on import. |
| `name` | string | yes | Snippet name used to `snip run <name>`. Max 128 chars. Non-alphanumeric chars (`[^a-zA-Z0-9_-]`) are replaced with `_` during import. |
| `language` | string | no | Language key (e.g. `bash`, `python`, `js`, `ts`, `go`, `sql`, `yaml`). Empty string if not set. |
| `tags` | array of strings | no | Optional metadata tags. Max 20 tags, each max 32 chars. |
| `createdAt` | string (ISO 8601) | yes | Creation timestamp |
| `updatedAt` | string (ISO 8601) | yes | Last modification timestamp |
| `content` | string | yes | Full snippet body. Can be multiline. Max 1MB. |

### Example: minimal snippet

```json
{
  "name": "hello",
  "content": "echo \"Hello, world!\""
}
```

### Example: pipe-friendly one-liner

```bash
snip list --json | jq '.[] | {name, language, tags}' > snippets-index.json
```

---

## Import format (`snip import <file>`)

Accepts the same JSON shape as the export format, with two structural variants:

### Variant A: `{ snippets: [...] }` (recommended)

```json
{
  "snippets": [
    { "name": "backup", "content": "pg_dump mydb > backup.sql" },
    { "name": "deploy", "content": "rsync -avz ./dist/ user@host:/var/www" }
  ]
}
```

### Variant B: Raw array (simpler for programmatic use)

```json
[
  { "name": "backup", "content": "pg_dump mydb > backup.sql" }
]
```

### Validation rules

All import validation lives in [`lib/commands/import.js`](../lib/commands/import.js).

| Rule | Check | Action on failure |
|------|-------|-------------------|
| **File size** | Max 5MB (`MAX_FILE_SIZE`) | Error and exit |
| **JSON parse** | Must be valid JSON | Error and exit |
| **Structure** | Must be an array or `{ snippets: [...] }` | Error and exit |
| **Count limit** | Max 500 snippets (`MAX_IMPORT_COUNT`) | Error and exit |
| **Empty list** | At least 1 snippet in array | Error and exit |
| **Entry type** | Each entry must be a non-array object | Entry skipped with warning |
| **`name`** | Must be a string or undefined | Entry skipped with warning |
| **`content`** | Must be a string or undefined | Entry skipped with warning |
| **`tags`** | Must be an array or undefined | Entry skipped with warning |
| **Name sanitization** | Non-alphanumeric chars replaced with `_` | Warning logged, name modified |
| **Duplicate names** | Not checked — each import creates a new snippet | Multiple snippets with same name allowed |

### Import behavior

- Valid snippets are added via `storage.addSnippet()` — this means names get sanitized.
- Invalid entries are silently skipped (count reported at end).
- Import is non-destructive: existing snippets are never overwritten.

---

## Internal JSON storage format

The on-disk `db.json` file (used by the JSON backend, at `~/.local/share/snip/db.json`) uses a different format — not recommended for import/export tooling, but documented for debugging:

```json
{
  "snippets": {
    "<uuid>": {
      "id": "<uuid>",
      "name": "snippet-name",
      "path": "/path/to/content/file.txt",
      "language": "bash",
      "tags": ["docker"],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-15T00:00:00.000Z",
      "lastUsedAt": null,
      "usageCount": 3
    }
  }
}
```

Key differences from export format:
- **`path`** — content is stored in a separate file (not inline). The path is `<dataDir>/snippets/<uuid>.<lang>`.
- **`usageCount`** — integer tracking how many times the snippet was run. Starts at 0.
- **`lastUsedAt`** — ISO 8601 timestamp of last execution, or `null`.
- **`origin`** — optional object with sync metadata (see below).

> ⚠️ The `db.json` format is internal and may change between versions. Always use `snip export` for stable, programmatic access.

---

## Config schema

Config file location: `~/.config/snip/config.json`

```json
{
  "editor": "code --wait",
  "dataDir": "/path/to/data",
  "dbPath": "/path/to/db.json",
  "useSqlite": false,
  "sqlitePath": "/path/to/snip.db",
  "defaultShell": "/bin/zsh",
  "confirmRun": true,
  "gist_token": "ghp_...",
  "sortMode": "name",
  "ai_provider": "openai",
  "ai_api_key": "sk-...",
  "ai_model": "gpt-3.5-turbo",
  "ai_max_tokens": 1000,
  "teamDir": "/path/to/team/snippets"
}
```

### Allowed config keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `editor` | string | `$EDITOR` or `vi` | Editor command (e.g. `vim`, `code --wait`, `nano`) |
| `dataDir` | string | `~/.local/share/snip` | Directory for snippet content files and DB |
| `dbPath` | string | `<dataDir>/db.json` | JSON database file path |
| `useSqlite` | boolean | `false` | Enable SQLite backend (requires `better-sqlite3` or `sql.js`) |
| `sqlitePath` | string | `~/.local/share/snip.db` | SQLite database file |
| `defaultShell` | string | `$SHELL` or `sh` | Shell used for execution |
| `confirmRun` | boolean | `true` | Show confirmation before running snippets |
| `gist_token` | string (sensitive) | — | GitHub Personal Access Token for gist sync (prefer `SNIP_GIST_TOKEN` env var) |
| `sortMode` | string | `name` | Default sort for `snip list`: `name`, `usage`, `recent` |
| `ai_provider` | string | `openai` | AI provider for `snip ai generate` |
| `ai_api_key` | string (sensitive) | — | API key for AI provider (prefer `SNIP_AI_API_KEY` env var) |
| `ai_model` | string | `gpt-3.5-turbo` | Model name for AI generation |
| `ai_max_tokens` | number | `1000` | Max tokens for AI response |
| `teamDir` | string | — | Shared snippet directory for team workspace |

Sensitive keys (`gist_token`, `ai_api_key`) should be set via environment variables instead of the config file. The config file will warn if you store them on disk.

---

## Gist sync origin tracking

When snippets are shared or synced via GitHub Gists, an `origin` metadata object is attached:

```json
{
  "gistId": "abc123"
}
```

This is stored:
- **SQLite backend**: in the `origin` TEXT column as a JSON string
- **JSON backend**: as an `origin` property on the snippet object in `db.json`

The `origin` is set by `setSnippetOrigin()` and read by `listSnippets()` / `getSnippetByIdOrName()`. It's used to track which gist a snippet was pushed to or pulled from, enabling `unshare` and `sync push` to reuse the same gist.

---

## SQLite schema

When SQLite is active (`useSqlite: true`), the internal table looks like:

```sql
CREATE TABLE snippets (
    id         TEXT PRIMARY KEY,
    name       TEXT,
    content    TEXT,
    language   TEXT,
    tags       TEXT,         -- JSON array string, e.g. '["docker","ops"]'
    createdAt  TEXT,
    updatedAt  TEXT,
    lastUsedAt TEXT,
    usageCount INTEGER DEFAULT 0,
    origin     TEXT          -- JSON object string, e.g. '{"gistId":"abc"}'
);
```

- `tags` and `origin` are stored as JSON TEXT columns and parsed on read.
- Content is stored inline (unlike the JSON backend where content is in separate files).

---

## Building import tools

For contributors writing import scripts, here's the minimal flow:

```javascript
// Read a file
const raw = fs.readFileSync('my-dump.json', 'utf8');

// Parse
let list;
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) {
  list = parsed;
} else if (parsed && parsed.snippets) {
  list = parsed.snippets;
} else {
  throw new Error('Invalid format');
}

// Validate and import
for (const entry of list) {
  if (typeof entry.content !== 'string') continue; // skip invalid
  const safeName = String(entry.name || 'imported').replace(/[^a-z0-9_-]/gi, '_');
  storage.addSnippet({
    name: safeName,
    content: entry.content,
    language: entry.language,
    tags: entry.tags || []
  });
}
```

For generating export-compatible JSON programmatically:

```python
import json, datetime

snippets = [
    {
        "id": "custom-id",
        "name": "my-script",
        "language": "python",
        "tags": ["automation", "dev"],
        "createdAt": datetime.datetime.now().isoformat() + "Z",
        "updatedAt": datetime.datetime.now().isoformat() + "Z",
        "content": "print('hello')"
    }
]

output = {
    "exportedAt": datetime.datetime.now().isoformat() + "Z",
    "snippets": snippets
}

print(json.dumps(output, indent=2))
```

---

## Limits summary

| Limit | Value | Enforced by |
|-------|-------|-------------|
| Content size | 1 MB | `storage.addSnippet()` |
| Name length | 128 chars | `storage.addSnippet()` |
| Tags per snippet | 20 | `storage.addSnippet()` |
| Tag length | 32 chars | `storage.addSnippet()` |
| Import file size | 5 MB | `importCmd()` |
| Snippets per import | 500 | `importCmd()` |
| Gist response size | 5 MB | `pullGist()` |
