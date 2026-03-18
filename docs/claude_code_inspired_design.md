# Claude Code-Inspired CLI Design for snip

This document outlines a comprehensive redesign of the snip CLI output to match the delightful, polished UX of Claude Code.

## Design Philosophy

Claude Code exemplifies terminal UX excellence through:

1. **Generous whitespace** — Breathing room creates clarity
2. **Visual hierarchy** — Primary information dominates, context is subtle
3. **Thoughtful typography** — Bold for important, dim for secondary
4. **Elegant animations** — Subtle transitions feel responsive, not distracting
5. **Actionable errors** — Every error tells you what to do next
6. **Progressive disclosure** — Simple by default, details available on demand

---

## New Color Palette

Retaining the `#ff4d00` brand identity while introducing a more sophisticated palette:

```javascript
const colors = {
  // Brand
  brand: '#ff4d00',        // Primary accent (snip name, actions)
  brandLight: '#ff7a33',   // Secondary accent
  brandDim: '#cc3d00',     // Subtle brand elements
  
  // Neutrals - inspired by Claude Code's warm grays
  background: '#0d0d0d',  // Terminal background feel
  surface: '#1a1a1a',     // Cards, panels
  surfaceLight: '#262626', // Elevated surfaces
  border: '#333333',      // Subtle dividers
  borderLight: '#404040', // Stronger dividers
  
  // Text hierarchy
  text: '#f5f5f5',        // Primary text
  textMuted: '#a0a0a0',   // Secondary text
  textDim: '#666666',     // Tertiary, hints
  
  // Semantic
  success: '#22c55e',    // Green - confirmations
  warning: '#eab308',    // Yellow - cautions  
  error: '#ef4444',      // Red - errors
  info: '#3b82f6',       // Blue - information
  
  // Special
  tag: '#f59e0b',        // Amber - tags
  code: '#a78bfa',       // Purple - code/commands
  path: '#34d399',       // Emerald - file paths
};
```

---

## Typography System

### Font Styles (using chalk/stylize)

| Style | Weight | Size | Usage |
|-------|--------|------|-------|
| `title` | Bold | 18px | Command headers, welcome messages |
| `heading` | Bold | 14px | Section headers, snippet names |
| `body` | Normal | 13px | Main content |
| `caption` | Normal | 12px | Metadata, timestamps |
| `dim` | Dim | 12px | Hints, secondary info |
| `code` | Normal | 13px | Snippet content, commands |

### Iconography

Use Unicode symbols for universal terminal support:

```javascript
const icons = {
  // Status
  success: '✓',
  warning: '⚠',
  error: '✗',
  info: 'ℹ',
  loading: '...',
  
  // Actions
  add: '+',
  edit: '✎',
  delete: '×',
  copy: '⎘',
  run: '▶',
  search: '⌘',
  list: '☰',
  
  // Navigation
  chevronRight: '›',
  chevronDown: '▼',
  bullet: '·',
  
  // Special
  sparkles: '✨',
  fire: '🔥',
  rocket: '🚀',
  folder: '📁',
  tag: '🏷',
  clock: '⏱',
  language: '⚡',
};
```

---

## Command Output Redesign

### 1. `snip list` — Current vs Redesigned

**Current:**
```
  NAME                        LANG       TAGS                          USED
  ───────────────────────────────────────────────────────────────────────────
  docker-dev                  sh         docker, dev                  12
  deploy-api                  sh         deploy, api                   8
  
  2 snippets
```

**Redesigned:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Your Snippets                                    🔥 2  ·  📁 All    │
├─────────────────────────────────────────────────────────────────────────┤
│  NAME              │  LANG    │  TAGS                   │  USED       │
│  ──────────────────┼──────────┼─────────────────────────┼─────────────│
│  ▶ docker-dev     │  ⚡ sh   │  🏷 docker  🏷 dev       │   12 ⚡     │
│  ▶ deploy-api     │  ⚡ sh   │  🏷 deploy 🏷 api        │    8        │
└─────────────────────────────────────────────────────────────────────────┘

  Tip:  snip search <query>  ·  snip ui  ·  snip add <name>
```

### 2. `snip search` — Current vs Redesigned

**Current:**
```
  Found 2 results for "docker"
  1. docker-dev  (sh) [docker, dev]
     └ snip docker-dev
  2. docker-build  (sh) [docker]
     └ snip docker-build
```

**Redesigned:**
```
  🔍 Searching "docker"...  found 2 results
  
  ┌──────────────────────────────────────────────────────────────────────┐
  │  1  │  docker-dev          ⚡ sh    🏷 docker, dev       ▶ Run    │
  │      │  docker run --rm -it {{image}} bash                      [12] │
  ├──────┼──────────────────────────────────────────────────────────────┤
  │  2  │  docker-build        ⚡ sh    🏷 docker           ▶ Run    │
  │      │  docker build -t {{tag}} .                               [ 8] │
  └──────┴──────────────────────────────────────────────────────────────┘
  
  → Press Enter to view  ·  r to run  ·  c to copy
```

### 3. `snip show` — Current vs Redesigned

**Current:**
```
  ─── docker-dev ───
  sh · tags: docker, dev · used: 12×

  docker run --rm -it ubuntu:24.04 bash
```

**Redesigned:**
```
  ┌────────────────────────────────────────────────────────────────────┐
  │  ✎ docker-dev                                      ⚡ sh   12 runs │
  ├────────────────────────────────────────────────────────────────────┤
  │  🏷 docker  ·  🏷 dev  ·  📁 /home/user/.snip/...                │
  ├────────────────────────────────────────────────────────────────────┤
  │                                                                    │
  │    docker run --rm -it ubuntu:24.04 bash                          │
  │                                                                    │
  └────────────────────────────────────────────────────────────────────┘
  
  →  r  Run now    c  Copy to clipboard    e  Edit    /  Search
```

### 4. `snip stats` — Current vs Redesigned

**Current:**
```
  ─── snip stats ───
  Snippets     24
  Total runs   156
  Most used    docker-dev (12 runs)

  Languages
  sh         ████████████ 10
  python     ████████ 8

  Top tags
  docker(5)  deploy(3)  api(2)
```

**Redesigned:**
```
  ╭────────────────────────────────────────────────────╮
  │           📊  Your snip Statistics                │
  ╰────────────────────────────────────────────────────╯
  
  ┌─────────────┬─────────────┬──────────────────────┐
  │   24        │    156       │      🔥 7           │
  │  Snippets   │  Total Runs  │  Day Streak         │
  └─────────────┴─────────────┴──────────────────────┘
  
  📈 Language Distribution
  
    ⚡ sh       ████████████████░░░░░  10
    🐍 python   ████████████░░░░░░░░░   8
    📦 js       ██████░░░░░░░░░░░░░░   4
    🔶 go       ████░░░░░░░░░░░░░░░░   2
  
  🏷 Top Tags
  
    docker    ████████░░  5
    deploy    ███░░░░░░░  3
    api       ██░░░░░░░░  2
    dev       ██░░░░░░░░  2
  
  ⚡ Most Used: docker-dev (12 runs)
```

### 5. `snip add` — Current vs Redesigned

**Current:**
```
Added snippet docker-dev (abc123)
```

**Redesigned:**
```
  ✨ Created: docker-dev
  
  ┌────────────────────────────────────────────────────┐
  │  ⚡ sh  ·  🏷 docker, dev                          │
  ├────────────────────────────────────────────────────┤
  │  docker run --rm -it ubuntu:24.04 bash           │
  └────────────────────────────────────────────────────┘
  
  → snip run docker-dev    → snip exec docker-dev
```

### 6. `snip exec` (success) — Current vs Redesigned

**Current:**
```
Running docker-dev...
```

**Redesigned:**
```
  ▶ Executing: docker-dev
  
  docker run --rm -it ubuntu:24.04 bash
  
  ─────────────────────────────────────────────────────
  (snippet output below)
  ─────────────────────────────────────────────────────
  
  ✓ Completed in 2.3s  ·  🎯 0 warnings
```

### 7. Error States — Current vs Redesigned

**Current:**
```
Error: "docker-deev" not found
```

**Redesigned:**
```
  ✗ Snippet not found: "docker-deev"
  
  ┌────────────────────────────────────────────────────┐
  │  Did you mean?                                     │
  │                                                    │
  │    → docker-dev  (most similar)                   │
  │    → docker-build                                  │
  │                                                    │
  │  Or search: snip search docker                    │
  └────────────────────────────────────────────────────┘
```

---

## Enhanced Interactive Elements

### Loading States

```javascript
// Spinner with message
console.log('  ⏳ Building search index...');
// Shows animated spinner: ▌ ▐ ▌ ▐

// Progress bar for operations
console.log('  ████████████░░░░░░░  50%  Syncing to Gist...');
```

### Progress Indicators

```javascript
// Multi-step progress
console.log('  1/3  Processing snippets...');
console.log('  2/3  Generating alias file...');
console.log('  3/3  ✓ Done!');
```

### Confirmation Prompts

```javascript
// Beautiful confirmation
console.log(`
  ⚠️  This will execute: docker-compose down -v
  
  Type "${c.brand('docker-deev')}" to confirm, or press Enter to cancel
`);
```

---

## Help System Enhancement

### Contextual Help

```javascript
// When user runs unknown command
console.log(`
  ✗ Unknown command: snip do-something
  
  Perhaps you meant?
    → snip add <name>    Create a snippet
    → snip run <name>   Run a snippet
    → snip search <q>    Find snippets
  
  View all commands: snip help
`);
```

### Inline Help Hints

After every command, show relevant next actions:
```
  →  r  Run    →  c  Copy    →  e  Edit    →  /  Search    →  q  Quit
```

---

## Animations (Terminal-Compatible)

### Typewriter Effect (for welcome messages)

```javascript
// Optional typewriter effect for first-run
const welcome = 'Welcome to snip v0.4.0';
for (const char of welcome) {
  process.stdout.write(char);
  await sleep(30);
}
```

### Fade Transitions

```javascript
// For TUI panels - subtle fade
console.log('  Loading snippets');
await sleep(200);
console.log('  ✓ Loaded 24 snippets');
// Use cursor positioning for smooth transitions
```

### Blinking Cursor for Input

```javascript
// Custom prompt with blinking indicator
const prompt = '  ⚡ Run snippet [docker-dev]: ';
```

---

## Design Tokens (CSS-like Variables)

```javascript
const tokens = {
  // Spacing
  spacing: {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 16,
    xxl: 24,
  },
  
  // Borders
  border: {
    radius: '8px',
    width: '1px',
    style: 'solid',
  },
  
  // Shadows (for potential TUI depth)
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 6px rgba(0,0,0,0.4)',
    lg: '0 10px 15px rgba(0,0,0,0.5)',
  },
  
  // Animation
  animation: {
    fast: '100ms',
    normal: '200ms',
    slow: '400ms',
  },
};
```

---

## Implementation Priority

| Priority | Component | Impact |
|----------|-----------|--------|
| 1 | Enhanced `snip list` output | High - most used |
| 2 | Beautiful error messages | High - daily experience |
| 3 | `snip search` redesign | High - frequent use |
| 4 | `snip stats` enhancement | Medium - occasional |
| 5 | Loading states | Medium - polish |
| 6 | Help system | Low - first-time users |
| 7 | Animations | Low - nice to have |

---

## Backward Compatibility

- All changes maintain `--json` output for scripting
- `--no-color` flag continues to work
- Plain text fallback when chalk unavailable
- Environment variable `NO_COLOR` respected

---

## Migration Path

1. Update `lib/colors.js` with new palette
2. Create `lib/icons.js` for icon constants
3. Create `lib/format.js` for reusable formatters
4. Update each command file incrementally
5. Add tests for new output formats

---

## Summary

This Claude Code-inspired design brings:

- **Delight** through thoughtful whitespace and hierarchy
- **Clarity** via consistent icons and color usage  
- **Helpfulness** with actionable error messages
- **Professionalism** with loading states and progress
- **Brand identity** while maintaining the `#ff4d00` accent

The result: a CLI that feels like a premium product, not just a utility.