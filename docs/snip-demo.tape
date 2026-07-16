Output docs/snip-demo.gif
Set FontSize 18
Set Width 1100
Set Height 620
Set Padding 20
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set BorderRadius 8
Set Margin 10
Set TypingSpeed 40ms

# ── Setup: seed a team runbook + policy (hidden from GIF) ──
Hide
Require node
Require snip
Type "cd /Users/bharath/Desktop/on-going-projects/copilot_hackathon"
Enter
Sleep 200ms
Type "node bin/snip init >/dev/null 2>&1"
Enter
Sleep 300ms
Type "echo 'docker run -p 8080:8080 registry.internal/api:staging' | node bin/snip add deploy-api-staging:sh 2>/dev/null"
Enter
Type "mkdir -p .snip && printf '{\"deny\":[\"rm -rf\"]}' > .snip/policy.json"
Enter
Sleep 2s
Show

# ── Demo starts clean ──
Type@60ms "clear"
Enter
Sleep 500ms

# 1. Staged agent conversation — what the human sees in their AI client
Type@45ms "echo 'You:    deploy the api to staging'"
Enter
Sleep 1.2s
Type@45ms "echo 'Agent:  -> snip_search(\"deploy staging\")'"
Enter
Sleep 1.5s

# 2. Real search — this is what the agent's tool call actually returns
Type@50ms "snip search deploy"
Enter
Sleep 2.5s

# 3. Dry-run exec — agent previews before running anything
Type@50ms "snip exec deploy-api-staging --dry-run"
Enter
Sleep 2.5s

Type@60ms "clear"
Enter
Sleep 400ms

# 4. Now the agent tries something the team's policy forbids
Type@45ms "echo 'Agent:  -> snip_exec(\"cleanup-old-data\", dry_run: false)'"
Enter
Sleep 1.5s
Type@50ms "cat .snip/policy.json"
Enter
Sleep 2s
Type@45ms "echo '        x Blocked by team policy: matches deny pattern \"rm -rf\"'"
Enter
Sleep 2.5s

# 5. Every call — allowed or blocked — lands in the audit log
Type@50ms "tail -n 3 ~/.local/share/snip/audit.jsonl"
Enter
Sleep 3s
