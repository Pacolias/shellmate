# Sourced via `bash --rcfile`, which replaces bash's normal ~/.bashrc lookup —
# so the first thing we do is load the user's real config ourselves, then
# append our hooks. Nothing here should change how the user's shell behaves;
# it only emits OSC 133 (prompt/command boundaries) and OSC 7 (cwd) sequences.

[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc"

__shellmate_osc7() {
  printf '\e]7;file://%s%s\a' "${HOSTNAME:-localhost}" "$PWD"
}

# Runs once per prompt cycle, right before the command the user typed starts
# executing. Guarded by a flag so it doesn't also fire for commands that are
# part of PROMPT_COMMAND itself.
__shellmate_preexec() {
  if [[ "${__shellmate_preexec_done:-0}" == "0" && "$BASH_COMMAND" != "$PROMPT_COMMAND" ]]; then
    __shellmate_preexec_done=1
    printf '\e]133;C\a'
  fi
}

# Runs after a command finishes, right before the next prompt is drawn.
__shellmate_prompt_end() {
  local exit_code=$?
  printf '\e]133;D;%s\a' "$exit_code"
  __shellmate_osc7
  printf '\e]133;A\a'
  __shellmate_preexec_done=0
}

trap '__shellmate_preexec' DEBUG

if [[ -n "$PROMPT_COMMAND" ]]; then
  PROMPT_COMMAND="__shellmate_prompt_end; $PROMPT_COMMAND"
else
  PROMPT_COMMAND="__shellmate_prompt_end"
fi

# \[ \] mark the escape sequence as zero-width so bash doesn't miscount the
# prompt length when wrapping lines. Emitted at the very end of PS1, right
# before the input area starts.
PS1="${PS1}"'\[\e]133;B\a\]'
