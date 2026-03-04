# Color Scheme — snip CLI

Unified brand palette used across the CLI and docs site.

## Primary palette

| Role | Hex | Usage |
|------|-----|-------|
| **Brand accent** | `#ff4d00` | Snippet names, headings, prompts, primary highlights |
| **Accent light** | `#ff7a33` | Index numbers, badges, secondary emphasis |
| **Tags** | `#F5A623` | Tag labels in list/search output |
| **Muted** | `#6C7086` | De-emphasized text, metadata |
| **Success** | `#16a34a` | Run confirmations, positive status |
| **Warning** | `#ca8a04` | Dangerous command warnings, caution prompts |
| **Error** | `#ef4444` | Error messages, failed operations |

## Docs site (index.html)

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#ff4d00` | CTAs, links, feature highlights |
| `--accent-light` | `#ff7a33` | Hover states, terminal command highlights |
| `--ink` | `#faf9f7` | Body text |
| `--paper` | `#0c0c0c` | Background |
| `--muted` | `#a3a3a3` | Subtitles, secondary text |

## Rules

- Respect `--no-color` flag and `NO_COLOR` env var.
- All chalk calls use graceful fallback — plain text when chalk is unavailable.
- `#ff4d00` is the brand identity color. Use it consistently as the primary accent.
