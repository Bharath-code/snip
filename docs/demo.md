# 🚀 snip: Full Product Demo Guide

Welcome to the ultimate guide for `snip`. This document will walk you through everything from your first snippet to advanced shell integration.

---

## 1. Installation & Setup

Get `snip` running on your machine in seconds.

```bash
# Install globally
npm install -g snip-manager

# Set up the shell widget (for Ctrl+G magic)
# Add this to your ~/.zshrc or ~/.bashrc
eval "$(snip widget)"
```

---

## 2. Core Workflow: Capture, Find, Run

### 📥 Capture: Saving your first snippet
You can add snippets interactively or pipe them directly.

```bash
# Interactive add (opens your $EDITOR)
snip add my_script --lang js --tags node,util

# Pipe from another command
echo "curl -X POST http://api.local/dev" | snip add quick_post --lang sh
```

### 🔍 Find: Listing your collection
Stay organized with powerful filtering and sorting.

```bash
# List all snippets
snip list

# Filter by tag or sort by most used
snip list --tag node --sort usage
```

### 🏃 Run: Instant execution
Execute any snippet by name or ID.

```bash
snip run quick_post
```

---

## 3. Advanced Features

### 🎚️ Parameters (Templates)
`snip` supports dynamic variables. Use `{{name}}` or `{{name:default}}` in your snippets.

**Example Snippet:**
```bash
docker run --rm -it {{image:ubuntu:24.04}} {{cmd:bash}}
```
When you run it, `snip` will interactively prompt you for the values!

### 🔗 Grab: Import from the Web
Import scripts directly from URLs or GitHub.

```bash
snip grab github:user/repo/scripts/backup.sh --name backup
```

### ⚡ Smart Search (fzf)
If you have `fzf` installed, use the interactive fuzzy finder with a live preview.

```bash
snip fzf
```

---

## 4. UI/UX & Safety Features

`snip` is designed to be both fast and safe.

### ⚠ Safety First
Automatically detects dangerous commands like `rm -rf` or `sudo`. If a snippet is risky, `snip` will demand an explicit `"yes"` confirmation before running.

### 🎨 Beautiful Terminal UI
The TUI (Terminal User Interface) gives you a full-screen view of your library.

```bash
snip ui
```
*   **Navigate** with arrow keys.
*   **Search** instantly.
*   **Run** with `Enter`.

### ⌨️ Shell Widget (Ctrl+G)
Once installed via `snip widget`, you can press `Ctrl+G` anytime in your terminal to fuzzy-search your snippets and insert them directly into your current command line.

---

## 5. Maintenance & Pro Tips

| Command | Description |
| :--- | :--- |
| `snip config` | View and edit your settings (editor, storage mode). |
| `snip export` | Backup your library to a JSON file. |
| `snip show --edit` | Quickly edit an existing snippet. |
| `snip stats` | See your most used snippets and productivity data. |

> [!TIP]
> **Switch to SQLite:** For large libraries, enable SQLite in your config for blazing-fast lookups and zero-downtime persistence.
> ```bash
> snip config set useSqlite true
> ```

---

**Happy Snipping!** 🐧
