# ZDOTDIR points here for the whole startup sequence (see .zshrc, which
# restores it at the end). .zshenv always runs first, even for
# non-interactive shells, so we just mirror the user's real one if they have
# it — the actual hook injection happens in .zshrc, since that's what loads
# for the interactive shell node-pty spawns.
[[ -f "$SHELLMATE_REAL_ZDOTDIR/.zshenv" ]] && source "$SHELLMATE_REAL_ZDOTDIR/.zshenv"
