# User Journey — CLI Snippet Manager (snip)

Persona: Solo developer (daily terminal user)

1) Discovery & Install
- Finds project via GitHub / npm / dev.to article.
- Installs: npm install -g snip

2) First run & onboarding
- Run: snip --help or snip setup
- Setup prompts: set editor (default $EDITOR), confirm storage paths, and recommend adding a first snippet.

3) Day-to-day usage
- Capture: while coding or debugging, add ephemeral commands or small functions with snip add "name" and paste or edit in $EDITOR.
- Recall: use snip search "keyword" to fuzzy-find the best matching snippet; use numbered selection to open or run.
- Reuse: snip run <id> to execute; snippet usageCount increments and lastUsedAt updates—improves ranking.
- Maintain: snip edit <id> to refine snippets over time; snip rm <id> to delete.

4) Sharing & Backup
- Export: snip export --file my-snips.json or snip export --gist to publish a public gist
- Sync: (Pro) enable cloud sync to access snippets across machines.

5) Advanced workflows
- Use snip in CI to inject common helper scripts (export/import to repo-specific snippet sets)
- Team share via gist or pro private team space

6) Retention loop
- Quick wins (time saved) encourage adding more snippets; higher usage improves search ranking, which increases convenience and retention.

