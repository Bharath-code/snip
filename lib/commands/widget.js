/**
 * Shell widget — outputs a shell function that binds snip to a hotkey.
 *
 * Usage:
 *   snip widget zsh    → eval "$(snip widget zsh)"   → Ctrl+G opens snip
 *   snip widget bash   → eval "$(snip widget bash)"  → Ctrl+G opens snip
 *   snip widget fish   → snip widget fish | source   → Ctrl+G opens snip
 */

const WIDGETS = {
    zsh: `
# snip shell widget for zsh — Ctrl+G to search and insert snippet
snip-widget() {
  local selected
  selected=$(snip fzf 2>/dev/null)
  if [[ -n "$selected" ]]; then
    LBUFFER+="$selected"
  fi
  zle reset-prompt
}
zle -N snip-widget
bindkey '^G' snip-widget
`,

    bash: `
# snip shell widget for bash — Ctrl+G to search and insert snippet
__snip_widget() {
  local selected
  selected=$(snip fzf 2>/dev/null)
  if [[ -n "$selected" ]]; then
    READLINE_LINE="\${READLINE_LINE:0:$READLINE_POINT}$selected\${READLINE_LINE:$READLINE_POINT}"
    READLINE_POINT=$(( READLINE_POINT + \${#selected} ))
  fi
}
bind -x '"\\C-g": __snip_widget'
`,

    fish: `
# snip shell widget for fish — Ctrl+G to search and insert snippet
function snip-widget
  set -l selected (snip fzf 2>/dev/null)
  if test -n "$selected"
    commandline -i -- $selected
  end
  commandline -f repaint
end
bind \\cg snip-widget
`
};

function widget(shell) {
    const s = (shell || '').toLowerCase().trim();

    if (!s) {
        // Auto-detect from $SHELL
        const detected = (process.env.SHELL || '').toLowerCase();
        if (detected.includes('fish')) return output('fish');
        if (detected.includes('zsh')) return output('zsh');
        return output('bash');
    }

    if (!WIDGETS[s]) {
        console.error(`Unknown shell: "${s}". Supported: zsh, bash, fish`);
        process.exitCode = 1;
        return;
    }

    output(s);
}

function output(shell) {
    process.stdout.write(WIDGETS[shell]);
}

module.exports = widget;
