#!/usr/bin/env bash
# snip shell completion — bash/zsh
# Add to ~/.bashrc or ~/.zshrc:
#   eval "$(snip completion)"

_snip_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  commands="add list search show run edit update rm delete export import sync ui config seed exec alias doctor cp mv cat recent fzf grab widget completion stats"

  case "${prev}" in
    snip)
      COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
      return 0
      ;;
    run|show|edit|update|rm|delete)
      # Complete with snippet names
      local names
      names=$(snip list --format names 2>/dev/null || snip list 2>/dev/null | awk '{print $1}')
      COMPREPLY=($(compgen -W "${names}" -- "${cur}"))
      return 0
      ;;
    --lang)
      COMPREPLY=($(compgen -W "sh bash zsh fish js ts python ruby php perl powershell" -- "${cur}"))
      return 0
      ;;
    --sort)
      COMPREPLY=($(compgen -W "name usage recent" -- "${cur}"))
      return 0
      ;;
    sync)
      COMPREPLY=($(compgen -W "push pull" -- "${cur}"))
      return 0
      ;;
    config)
      COMPREPLY=($(compgen -W "set get" -- "${cur}"))
      return 0
      ;;
    set)
      if [[ "${COMP_WORDS[1]}" == "config" ]]; then
        COMPREPLY=($(compgen -W "editor useSqlite defaultShell confirmRun gist_token" -- "${cur}"))
      fi
      return 0
      ;;
  esac

  # Option completions per subcommand
  case "${COMP_WORDS[1]}" in
    add)
      COMPREPLY=($(compgen -W "--lang --tags" -- "${cur}"))
      ;;
    list)
      COMPREPLY=($(compgen -W "--tag --lang --sort" -- "${cur}"))
      ;;
    run)
      COMPREPLY=($(compgen -W "--dry-run --confirm" -- "${cur}"))
      ;;
    update)
      COMPREPLY=($(compgen -W "--tags --lang" -- "${cur}"))
      ;;
    show)
      COMPREPLY=($(compgen -W "--edit" -- "${cur}"))
      ;;
  esac
}

complete -F _snip_completions snip
