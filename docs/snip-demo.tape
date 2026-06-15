Output docs/snip-demo.gif
Set FontSize 20
Set Width 1000
Set Height 480
Set Padding 20
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set BorderRadius 8
Set Margin 10
Set TypingSpeed 40ms

# ── Setup: seed example snippets (hidden from GIF) ──
Hide
Require node
Require snip
Type "cd /Users/bharath/Desktop/on-going-projects/copilot_hackathon"
Enter
Sleep 200ms
Type "node bin/snip seed 2>/dev/null"
Enter
Sleep 2s
Show

# ── Demo starts clean ──
Type@60ms "clear"
Enter
Sleep 600ms

# 1. List all snippets
Type@50ms "snip list"
Enter
Sleep 3s

# 2. Fuzzy search for docker snippets
Type@50ms "snip search docker"
Enter
Sleep 2.5s

# 3. Show snippet details
Type@50ms "snip show docker-run-shell"
Enter
Sleep 3s

# 4. Dry-run execute (safe preview)
Type@50ms "snip exec docker-run-shell --dry-run"
Enter
Sleep 2.5s

# 5. Quick-add a snippet via pipe
Type@50ms "echo print_hello_world | snip add:py hello"
Enter
Sleep 2s

# 6. Show statistics and streak
Type@50ms "snip stats"
Enter
Sleep 3s
Type@50ms "snip stats --streak"
Enter
Sleep 2.5s

# 7. Run the new snippet
Type@50ms "snip run hello"
Enter
Sleep 3s
