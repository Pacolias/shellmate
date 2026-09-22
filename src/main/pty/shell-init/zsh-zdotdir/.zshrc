# Loaded because ZDOTDIR still points at our fake dotfiles directory (see
# .zshenv). We load the user's real .zshrc first, add our hooks, then
# restore ZDOTDIR to what it really was — so any subshell the user spawns
# from here on behaves exactly like their normal zsh, not ours.

[[ -f "$SHELLMATE_REAL_ZDOTDIR/.zshrc" ]] && source "$SHELLMATE_REAL_ZDOTDIR/.zshrc"

__shellmate_osc7() {
  print -Pn "\e]7;file://%M%d\a"
}

__shellmate_precmd() {
  local exit_code=$?
  printf '\e]133;D;%s\a' "$exit_code"
  __shellmate_osc7
  printf '\e]133;A\a'
}

# zsh's preexec hook receives the about-to-run command line as $1.
# Base64-encoded for the same reason as bash's version: arbitrary quoting
# must never corrupt the OSC payload.
__shellmate_preexec() {
  local encoded
  encoded=$(printf '%s' "$1" | base64 | tr -d '\n')
  printf '\e]133;C;%s\a' "$encoded"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __shellmate_precmd
add-zsh-hook preexec __shellmate_preexec

# %{ %} mark the escape sequence as zero-width so zsh doesn't miscount the
# prompt length when wrapping lines. Emitted at the very end of PS1, right
# before the input area starts.
PS1="${PS1}"'%{'$'\e]133;B\a''%}'

export ZDOTDIR="$SHELLMATE_REAL_ZDOTDIR"
