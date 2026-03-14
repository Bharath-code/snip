# Import / Export Schema

For tooling and contributors: machine-readable format used by `snip export` and `snip import`.

## Export format (snip export [file])

JSON object:

```json
{
  "exportedAt": "2026-03-14T12:00:00.000Z",
  "snippets": [
    {
      "id": "uuid",
      "name": "snippet-name",
      "language": "bash",
      "tags": ["docker", "ops"],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "content": "#!/bin/bash\n..."
    }
  ]
}
```

- **exportedAt** (string): ISO 8601 date when export was run.
- **snippets** (array): List of snippet objects.
  - **id** (string): Unique identifier.
  - **name** (string): Snippet name (used with `snip run <name>`).
  - **language** (string): Language key (e.g. `bash`, `python`).
  - **tags** (array of strings): Optional tags.
  - **createdAt**, **updatedAt** (strings): ISO 8601 dates.
  - **content** (string): Full snippet body (can be multiline).

## Import (snip import <file>)

- Accepts the same JSON shape. `snippets` is required; each entry is validated (name, content, tags).
- **Limits:** max file size 5MB, max 500 snippets per import.
- **Validation:** See `lib/commands/import.js` `validateEntry()`. Invalid entries are skipped; valid ones are added.

## Gist sync

Gist push/pull use GitHub’s Gist API. Pull creates one snippet per Gist file; `origin.gistId` is set for push/pull tracking.
