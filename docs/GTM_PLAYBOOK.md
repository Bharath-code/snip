# snip — GTM Launch Playbook

You have: 70 views + 9 hearts on dev.to, a shipped product, solid README, docs site.
You need: **500 GitHub stars in 2 weeks** to hit escape velocity.

---

## The Core Angle

> **"The `!!` of snippets."**

Every dev has commands they re-type. snip is the only CLI snippet manager with **unix pipeline integration**, **multi-language execution**, and **dangerous command detection**. That's the hook.

---

## 🔴 Tier 1 — Do These Today

### 1. Reddit (highest ROI for CLI tools)

**Target subreddits** (post to ONE per day, not all at once — Reddit penalizes spam):

| Subreddit | Members | Post Style |
|-----------|---------|------------|
| r/commandline | 250k+ | "I built a snippet manager that actually runs code" |
| r/linux | 900k+ | "Show r/linux: snip — save, search, run snippets from terminal" |
| r/programming | 6M+ | "I built a CLI tool that replaces my shell aliases" |
| r/webdev | 2M+ | "Built a dev tool for my own workflow, open-sourced it" |
| r/selfhosted | 400k+ | Self-hosted angle: local-first, no cloud |
| r/opensource | 100k+ | OSS story: built this for a hackathon, now it's real |
| r/devops | 300k+ | DevOps-specific: deploy scripts, docker snippets |
| r/node | 200k+ | Built with Node.js angle, technical deep-dive |

#### Reddit Post Template (r/commandline)

```
Title: I built "snip" — a terminal snippet manager that actually executes code across any language

I kept losing one-off deploy scripts, docker commands, and API calls in my shell
history. So I built snip.

What makes it different from pet/navi/aliases:

- Runs snippets in any language (sh, python, js, ruby) — not just shell
- Pipeline mode: `echo '{"host":"prod"}' | snip pipe deploy --json`
- Dangerous command detection (warns on rm -rf, sudo)
- Interactive TUI with syntax highlighting
- Parameterized templates: `docker run {{image:ubuntu}} {{cmd:bash}}`
- Zero config: `npm install -g snip-manager`

GitHub: https://github.com/Bharath-code/snip
npm: https://npmjs.com/package/snip-manager

Would love feedback — especially on what commands you'd want.
```

> [!IMPORTANT]
> **Reddit rules:** Don't cross-post. Write a unique intro for each sub. Reply to EVERY comment within the first 2 hours. Upvote timing matters — ask 3 friends to upvote within the first 30 minutes.

---

### 2. Hacker News — Show HN

**Post on a Tuesday or Wednesday, 10 AM ET.** This is when Show HN gets the most traffic.

```
Title: Show HN: Snip – Terminal snippet manager with multi-lang execution and unix pipelines

URL: https://github.com/Bharath-code/snip

First comment (post immediately):

Hi HN, I built snip because I kept losing deploy scripts and docker
commands in my shell history. The existing tools (pet, navi) only run
shell commands — snip runs JS, Python, Ruby, anything.

The feature I'm most proud of: `snip pipe`. You can pipe JSON into a
snippet to fill template variables — makes it composable with CI/CD
and unix pipelines.

Built with Node.js, Commander.js, blessed for TUI, Fuse.js for fuzzy
search. Zero external services, fully local-first.

npm install -g snip-manager

Would love feedback on the API design and what's missing.
```

> [!TIP]
> HN rewards technical depth. If someone asks "why not just use shell functions?" — have a detailed answer ready about template variables, multi-language support, and safety.

---

### 3. Twitter/X — Launch Thread

Post at **9 AM ET on a weekday**. Thread format:

```
Tweet 1 (hook):
I built a terminal tool that replaces my 47 shell aliases.

It runs snippets in any language, detects dangerous commands,
and pipes JSON into templates.

Open source, zero config.

🧵 Here's what makes snip different:

Tweet 2:
The problem:
→ Aliases break across machines
→ Shell history disappears  
→ You can't run a Python snippet from a shell alias

snip stores code snippets and runs them in their native language.

`snip exec deploy-api`    ← runs immediately
`snip run deploy-api`     ← previews first

Tweet 3:
The killer feature: pipeline mode.

echo '{"host":"prod"}' | snip pipe deploy --json

Pipe JSON → template variables get filled → snippet runs.

No other snippet manager does this.

Tweet 4:
Safety built in:

snip detects `rm -rf`, `sudo`, and destructive commands.
Shows a warning before execution.

Because running the wrong deploy script at 3am shouldn't be easy.

Tweet 5:
Template variables with defaults:

docker run {{image:ubuntu:24.04}} {{cmd:bash}}

When you run the snippet, snip prompts for each variable.
Defaults are pre-filled. Press Enter to accept.

Tweet 6:
It's open source. MIT license.

npm install -g snip-manager

GitHub: github.com/Bharath-code/snip
Website: bharath-code.github.io/snip/

I'd love your feedback — what commands do you wish existed?
```

**Hashtags for discoverability:** `#cli` `#devtools` `#opensource` `#webdev` `#terminal`

---

## 🟡 Tier 2 — Do This Week

### 4. Product Hunt

- **Prep assets:** 5 screenshots (TUI, pipe mode, exec, template prompts, doctor), a 30-second GIF
- **Launch on Tuesday** — the day with highest traffic
- **Tagline:** "Your terminal's memory — save, search, run code snippets in ms"
- **Get 5 hunter-friends** to upvote + leave comments in the first 2 hours

### 5. Dev.to — Follow-Up Articles

Your first post got 70 views. That's good for dev.to. Now write **targeted articles**:

| Article Title | Target Audience |
|---------------|-----------------|
| "I replaced 50 shell aliases with one CLI tool" | Shell power users |
| "Building a dangerous command detection system in Node.js" | Technical builders |
| "How I built a TUI with Blessed in 500 lines" | Node.js devs |
| "Unix pipeline integration for CLI tools — the missing pattern" | Systems engineers |

Each article links back to snip naturally. Dev.to SEO indexing is fast.

### 6. Hashnode

Cross-post your best dev.to article. Different audience. Tag: `#cli`, `#node`, `#opensource`.

### 7. Discord Servers

Join these and share in `#showcase` or `#projects` channels:

- **The Programmer's Hangout** (100k+ members)
- **Nodeiflux** (Node.js community)
- **DevCord**
- **Reactiflux** (has general channels)

Don't just drop a link — say: *"Hey, I built this and would love feedback on X specific thing"*.

---

## 🟢 Tier 3 — This Month

### 8. GitHub Awesome Lists

Submit PRs to:

- [awesome-cli-apps](https://github.com/agarrharr/awesome-cli-apps)
- [awesome-shell](https://github.com/alebcay/awesome-shell)
- [terminals-are-sexy](https://github.com/k4m4/terminals-are-sexy)
- [awesome-nodejs](https://github.com/sindresorhus/awesome-nodejs)

These lists drive steady organic traffic for months.

### 9. YouTube / Short-Form Video

Record a **60-second terminal demo** (use [vhs](https://github.com/charmbracelet/vhs) or asciinema):

1. `snip add` a deploy script (5s)
2. `snip search` finds it (3s)
3. `snip pipe` with JSON values (10s)
4. `snip ui` TUI walkthrough (15s)
5. `snip doctor` health check (5s)

Post as: YouTube Short, Twitter video, Reddit video post.

### 10. LinkedIn

Write a professional post:

```
I built an open-source developer tool and published it on npm.

The problem: developers lose useful commands in shell history.
The solution: snip — a CLI snippet manager that runs code in any language.

What I learned building it:
• Commander.js for CLI parsing
• Fuse.js for fuzzy search
• Blessed for terminal UIs
• SQLite for optional persistence

1,000+ lines of code. 58 tests. 20+ commands.

GitHub: [link]

#opensource #nodejs #developertools
```

---

## 📅 2-Week Sprint Calendar

| Day | Action |
|-----|--------|
| **Day 1** | Post to r/commandline + launch Twitter thread |
| **Day 2** | Post to r/programming + reply to all Day 1 comments |
| **Day 3** | Submit Show HN (10 AM ET) + post to r/linux |
| **Day 4** | Write dev.to article #2 ("I replaced 50 aliases") |
| **Day 5** | Post to r/devops + Discord showcase channels |
| **Day 6** | Cross-post to Hashnode + LinkedIn |
| **Day 7** | Rest. Reply to accumulated comments everywhere |
| **Day 8** | Record 60-second demo video |
| **Day 9** | Post video to Twitter + YouTube Short |
| **Day 10** | Submit PRs to awesome-lists (2 lists) |
| **Day 11** | Write dev.to article #3 (technical deep-dive) |
| **Day 12** | Post to r/webdev + r/node |
| **Day 13** | Prep Product Hunt assets |
| **Day 14** | Launch on Product Hunt (Tuesday) |

---

## Metrics to Track

| Metric | Day 1 | Week 1 Target | Week 2 Target |
|--------|-------|---------------|---------------|
| GitHub stars | current | 100 | 500 |
| npm weekly downloads | current | 200 | 1,000 |
| dev.to views | 70 | 500 | 2,000 |
| Twitter impressions | 0 | 5,000 | 20,000 |

---

## The One Rule

**Every post must end with a question.** Not "check out my tool" — but "what commands do you wish existed?" or "what's missing?" Questions get comments. Comments get algorithm boost. Algorithm boost gets visibility.
