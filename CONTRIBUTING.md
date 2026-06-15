# Contributing to snip

Thank you for your interest in contributing to **snip** — the terminal-native CLI snippet manager.

- [Code of Conduct](#code-of-conduct)
- [Your First Command in 10 Minutes](#your-first-command-in-10-minutes)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Running Tests & Lint](#running-tests--lint)
- [Coding Standards](#coding-standards)
- [How Can I Contribute?](#how-can-i-contribute)
- [Commit Message Format](#commit-message-format)
- [License](#license)

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

---

## Your First Command in 10 Minutes

This walkthrough shows you how to add a new `snip` subcommand from scratch. We'll use a real example — adding a `snip greet` command that says hello.

### Step 1: Create the command file

Every command lives in `lib/commands/<name>.js`. Create your file:

```bash
touch lib/commands/greet.js
```

Paste this template:

```js
/**
 * snip greet — a friendly hello command.
 *
 * Usage:
 *   snip greet              # says hello to you
 *   snip greet "World"      # says hello to World
 *   snip greet --json       # JSON output
 */

const { c } = require('../colors');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');

function greetCmd(name, opts = {}) {
  const target = name || 'you';

  if (opts.json) {
    // --json: always print to stdout (not log) for piping
    console.log(JSON.stringify({ greeting: `Hello, ${target}!` }));
    return;
  }

  // Standard terminal output
  log(c.brand(`  👋 Hello, ${target}!`));
}

module.exports = greetCmd;
```

**Key conventions used:**
- Use `require('../colors').c` for colors — never use chalk directly
- Use `require('../quiet').log` for decorative output (suppressed by `--quiet`)
- Use `require('../cli-utils').setExitCode(code)` to set non-zero exit codes
- Use `console.log` for data output (JSON, pipable content) — these pass through quiet mode
- Always describe the command in a JSDoc block at the top

### Step 2: Register the command in cli.js

Open `lib/cli.js` and add two things:

**A. Add the require at the top (around line 30, with the other requires):**

```js
const greetCmd = require('./commands/greet');
```

**B. Add the command registration (after the other commands, before the final `program.parse`):**

```js
program
  .command('greet [name]')
  .description('Say hello (example command for contributors)')
  .option('--json', 'Output as JSON')
  .action((name, opts) => greetCmd(name, opts));
```

### Step 3: Test it locally

```bash
node bin/snip greet              # → 👋 Hello, you!
node bin/snip greet "World"      # → 👋 Hello, World!
node bin/snip greet --json       # → { "greeting": "Hello, you!" }
node bin/snip greet --help       # → shows your command description
```

### Step 4: Add a test

Create `__tests__/greet.test.js`:

```js
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('greet command', () => {
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-greet-test-${Date.now()}`);
    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = configDir;
    process.env.XDG_DATA_HOME = dataDir;
    jest.resetModules();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('greets the user', () => {
    const greet = require('../lib/commands/greet');
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    greet('World', {});
    spy.mockRestore();

    expect(logs.join(' ')).toContain('Hello, World!');
  });

  test('greets "you" by default', () => {
    const greet = require('../lib/commands/greet');
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    greet(undefined, {});
    spy.mockRestore();

    expect(logs.join(' ')).toContain('Hello, you!');
  });

  test('supports --json output', () => {
    const greet = require('../lib/commands/greet');
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    greet('World', { json: true });
    spy.mockRestore();

    expect(logs.join(' ')).toContain('"Hello, World!"');
  });
});
```

Run it:

```bash
npx jest __tests__/greet.test.js --verbose
```

### Step 5: Add shell completions (optional)

If your command has flags, add them to `completions/snip.bash` and `completions/snip.fish`:

**bash** (`completions/snip.bash`):
```bash
    greet)
    COMPREPLY=( $(compgen -W "--json" -- "$cur") )
    ;;
```

**fish** (`completions/snip.fish`):
```fish
complete -c snip -f -n "__snip_has_no_command" -a greet -d "Say hello"
complete -c snip -f -n "__snip_has_command greet" -l json -d "JSON output"
```

### That's it! 🎉

From file creation to running tests — a new snip command in about 10 minutes. Here's the checklist for any new command:

| Step | File(s) | Done? |
|------|---------|-------|
| 1. Create command | `lib/commands/<name>.js` | ☐ |
| 2. Register command | `lib/cli.js` (require + program.command) | ☐ |
| 3. Test locally | Run `node bin/snip <name>` | ☐ |
| 4. Write tests | `__tests__/<name>.test.js` | ☐ |
| 5. Add completions | `completions/snip.bash`, `completions/snip.fish` | ☐ |

---

## Project Structure

```
snip/
├── bin/snip                  # Entry point (small — delegates to lib/cli.js)
├── lib/
│   ├── cli.js                # Commander.js program — all command registrations
│   ├── cli-utils.js          # Shared helpers: parseNameWithLang, setExitCode, exitProcess
│   ├── colors.js             # Unified brand color palette (chalk + fallback)
│   ├── quiet.js              # Quiet-mode helpers (SNIP_QUIET env var)
│   ├── storage.js            # Storage abstraction — JSON + SQLite backends
│   ├── search.js             # Fuse.js fuzzy search with cache invalidation
│   ├── exec.js               # Multi-language snippet runner
│   ├── template.js           # {{variable:default}} template engine
│   ├── safety.js             # Dangerous command detection (14+ patterns)
│   ├── config.js             # Config loader (XDG_CONFIG_HOME)
│   ├── format.js             # Terminal formatting (tables, progress bars)
│   ├── icons.js              # Emoji icons for all languages/tags
│   ├── readline.js           # Interactive prompt helpers
│   ├── clipboard.js          # Cross-platform clipboard
│   ├── lock.js               # File-based exclusive lock for storage
│   ├── streak.js             # Usage streak tracking
│   └── commands/             # One file per CLI subcommand (25+)
│       ├── add.js            # snip add
│       ├── list.js           # snip list
│       ├── search.js         # snip search
│       ├── stats.js          # snip stats (good reference for simple commands)
│       └── ...               # All other commands
├── __tests__/                # Jest tests — one file per module
│   ├── add.test.js
│   ├── list.test.js
│   └── ...
├── completions/              # Shell completion scripts
│   ├── snip.bash
│   └── snip.fish
├── docs/                     # Website + demo + plans
│   ├── snip-demo.gif         # Animated demo
│   └── ...
├── scripts/                  # Utility scripts
│   └── seed-examples.js      # Example snippet seeder
└── package.json
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **Single file per command** | Easy to find, easy to add, easy to test |
| **No daemon** | Every invocation is stateless — fast cold starts |
| **Dual storage (JSON + SQLite)** | JSON for zero-config start, SQLite for scale |
| **Unified colors via `lib/colors.js`** | Brand consistency — use `c.brand()`, `c.dim()`, etc. |
| **Quiet mode via `lib/quiet.js`** | `log()` for decorative output, `console.log` for data — makes scripting/CI clean |
| **Centralized exit codes** | `setExitCode()` for normal returns, `exitProcess()` for immediate shutdown |

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bharath/snip.git
cd snip

# Install dependencies
npm install

# Run locally (no global install needed)
node bin/snip --help

# Seed example snippets
node bin/snip seed

# Try it out
node bin/snip list
node bin/snip search docker
```

### Testing Locally While Developing

```bash
# Link the package globally for testing
npm link

# Now you can use `snip` directly
snip init
snip list
snip stats

# Unlink when done
npm unlink -g snip-manager
```

---

## Running Tests & Lint

```bash
# Run all tests
npm test

# Run a single test file
npx jest __tests__/stats.test.js --verbose

# Run tests with coverage
npx jest --coverage

# Run tests matching a pattern
npx jest --testPathPattern="safety|search"

# Run lint (ESLint on lib/)
npm run lint

# Both in sequence
npm test && npm run lint
```

### Test Best Practices

All tests in this project follow these patterns:

1. **Isolation:** Every test creates its own temp directory via `XDG_CONFIG_HOME` and `XDG_DATA_HOME` (the `jest.setup.js` handles this automatically)
2. **Module isolation:** Use `jest.resetModules()` in `beforeEach` when testing modules that read from storage/config
3. **Console mocking:** Capture output by spying on `console.log` / `console.error` — always restore with `.mockRestore()`
4. **No side effects:** Tests never modify real user data or shell history

Example test structure:

```js
describe('My Command', () => {
  beforeEach(() => {
    jest.resetModules(); // fresh module state
    // Environment is already isolated by jest.setup.js
  });

  test('does something', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    // Test your command here...

    spy.mockRestore();
    expect(logs[0]).toContain('expected output');
  });
});
```

---

## Coding Standards

### JavaScript

- **2 spaces** for indentation (no tabs)
- **Semicolons** required
- **Single quotes** for strings (double quotes only for JSON or strings containing `'`)
- **`const`** by default, `let` only when reassigning, never `var`
- **Arrow functions** preferred over `function` keyword for callbacks
- **Named exports** — each command file exports one function

### Project-Specific Rules

| Rule | Details |
|------|---------|
| **Use `c.` colors** | Always use `require('../colors').c` — never `chalk` directly |
| **Use `log()` for decoration** | Use `require('../quiet').log()` for non-essential output |
| **Use `console.log` for data** | JSON, list results, snippet content must use `console.log` |
| **Use `setExitCode()`** | Never set `process.exitCode` directly — use the helper |
| **Use `exitProcess()` sparingly** | Only for signal handlers and TUI cleanup |
| **Errors to stderr** | Error messages go to `console.error`, never `console.log` |
| **Descriptive JSDoc** | Every command file starts with a usage comment block |
| **Keep functions small** | One responsibility per function |

### File Organization

Each command file follows this template:

```js
/**
 * snip <name> — <one-line description>.
 *
 * Usage:
 *   snip <name> [args]
 *   snip <name> [args] --json
 */

const { c } = require('../colors');
const { log } = require('../quiet');
const { setExitCode } = require('../cli-utils');
// ... other requires as needed

function myCommand(args, opts = {}) {
  // 1. Validate input
  // 2. Do the work
  // 3. Output results
  // 4. Handle errors with setExitCode(1)
}

module.exports = myCommand;
```

---

## How Can I Contribute?

### Reporting Bugs

1. **Search existing issues** — Check if the bug has already been reported
2. **Use the bug template** — Include detailed steps to reproduce
3. **Include context** — OS, Node.js version, and snip version

### Suggesting Features

1. **Check existing discussions** — Maybe someone already proposed it
2. **Use the feature request template** — Describe the problem and solution
3. **Explain use cases** — How would you use this feature?

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes** — Follow the coding standards above
4. **Add tests** — See the "Your First Command" guide for test patterns
5. **Run tests & lint**: `npm test && npm run lint`
6. **Commit with clear messages**: See [commit format](#commit-message-format) below
7. **Push and create PR**: `git push origin feature/my-feature`

### Good First Issues

Look for issues labeled [`good first issue`](https://github.com/bharath/snip/labels/good%20first%20issue) on GitHub.

---

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes:** `add`, `list`, `search`, `exec`, `storage`, `ui`, `cli`, `docs`, etc.

**Examples:**

```
feat(add): Add --tags flag to snip add command

Allows users to add multiple tags when creating a snippet.

Closes #123
```

```
fix(search): Handle empty query gracefully

Prevents crash when snip search is called with no query.
```

```
test(storage): Add SQLite backend tests

Covers listSnippets, addSnippet, deleteSnippet with SQLite.
```

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
