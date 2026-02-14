# UI / UX Specification — CLI Snippet Manager (snip)

Goal: design a keyboard-first experience that feels native in the terminal and requires minimal friction to add, find, and run snippets.

Primary principals
- Invisible flow: most actions should be doable with a single command or two keystrokes.
- Defaults over flags: smart defaults (editor, storage path) minimize typing.
- Progressive disclosure: start simple, expose advanced flags later.

Commands and core flows
- snip add <name> [--lang] [--tags]
  - Behavior: open $EDITOR with a template comment showing available placeholders; save persists the snippet.
  - Shortcut: echo "..." | snip add <name> to pipe content in

- snip list [--tag/-t <tag>] [--lang <lang>] [--sort <recent|usage|name>]
  - Behavior: prints a compact table (id, name, tags, lastUsedAt, usageCount)

- snip show <id|name>
  - Behavior: opens snippet content in $PAGER or $EDITOR when --edit passed

- snip search <query>
  - Behavior: fuzzy matches across title, tags, and content; prints ranked results with preview snippet; numbered selection allows quick action
  - Quick actions after search: (enter) show, (r) run, (c) copy to clipboard, (e) edit

- snip run <id|name> [--confirm] [--dry-run] [--shell <bash|sh|zsh>]
  - Behavior: prints snippet, asks for confirmation (unless --confirm), runs in child process

- snip config [get|set] <key> <value>
  - Keys: editor, storage_path, gist_token, default_shell, confirm_run

Interactive mode (future)
- snip ui
  - Fuzzy search immediately on launch; keybindings: j/k, enter to show, r to run, t to toggle tags filter, / to start new search

Accessibility and colors
- Provide simple colorized output using chalk: names in primary color, tags in accent, warnings in warning color, success in green.
- Respect TERM and --no-color flag.

Onboarding
- After install, show a short "getting started" help on first run and suggest setting editor and adding the first snippet.

Keyboard-first examples (quick cheatsheet)
- Add: snip add "deploy script"
- Search + run: snip search "deploy" -> press r -> confirm -> run
- List by tag: snip list -t docker

