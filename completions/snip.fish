# snip shell completion — fish
# Add to ~/.config/fish/config.fish:
#   source (snip completion fish | psub)

# Disable file completions by default
complete -c snip -f

# Subcommands
complete -c snip -n "__fish_use_subcommand" -a "add" -d "Add a new snippet"
complete -c snip -n "__fish_use_subcommand" -a "list" -d "List snippets"
complete -c snip -n "__fish_use_subcommand" -a "search" -d "Fuzzy search snippets"
complete -c snip -n "__fish_use_subcommand" -a "show" -d "Show snippet content"
complete -c snip -n "__fish_use_subcommand" -a "run" -d "Run a snippet"
complete -c snip -n "__fish_use_subcommand" -a "edit" -d "Edit snippet in editor"
complete -c snip -n "__fish_use_subcommand" -a "update" -d "Update snippet metadata"
complete -c snip -n "__fish_use_subcommand" -a "rm" -d "Remove a snippet"
complete -c snip -n "__fish_use_subcommand" -a "delete" -d "Remove a snippet"
complete -c snip -n "__fish_use_subcommand" -a "export" -d "Export snippets"
complete -c snip -n "__fish_use_subcommand" -a "import" -d "Import snippets"
complete -c snip -n "__fish_use_subcommand" -a "sync" -d "Sync with GitHub Gists"
complete -c snip -n "__fish_use_subcommand" -a "ui" -d "Interactive TUI"
complete -c snip -n "__fish_use_subcommand" -a "config" -d "View/modify config"

# Options per subcommand
complete -c snip -n "__fish_seen_subcommand_from add" -l lang -d "Language"
complete -c snip -n "__fish_seen_subcommand_from add" -l tags -d "Comma-separated tags"
complete -c snip -n "__fish_seen_subcommand_from list" -s t -l tag -d "Filter by tag"
complete -c snip -n "__fish_seen_subcommand_from list" -l lang -d "Filter by language"
complete -c snip -n "__fish_seen_subcommand_from list" -l sort -d "Sort order" -a "name usage recent"
complete -c snip -n "__fish_seen_subcommand_from run" -l dry-run -d "Print without executing"
complete -c snip -n "__fish_seen_subcommand_from run" -l confirm -d "Skip confirmation"
complete -c snip -n "__fish_seen_subcommand_from update" -l tags -d "Comma-separated tags"
complete -c snip -n "__fish_seen_subcommand_from update" -l lang -d "Language"
complete -c snip -n "__fish_seen_subcommand_from sync" -a "push pull"
complete -c snip -n "__fish_seen_subcommand_from config" -a "set get"
