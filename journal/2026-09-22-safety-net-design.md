# Safety net: preview + trash design

**Date:** 2026-09-22
**Phase:** Phase 3

## Preview (`preview.service.ts`)

Resolves what an `rm`/`mv` command's arguments would actually touch,
without running anything — reused `resolveEffectiveInvocation` (exported
from `danger-classifier.ts`, previously private) so "how do we unwrap
`sudo`" stays defined in exactly one place. Uses Node 22's built-in
`fs.globSync` (no new dependency) for glob patterns, since that's already
available in this project's Node version. Literal (non-glob) arguments are
checked for existence directly rather than globbed, so a typo'd path that
doesn't exist yet is reported as `missing: true` instead of just vanishing
from the preview with no explanation.

`mv`'s last argument is treated as the destination (not glob-resolved or
existence-checked — it's where things are going) and everything before it
as sources, matching real `mv` semantics.

## Trash (`trash.service.ts`)

Implements the freedesktop.org Trash spec for the home trash only
(`~/.local/share/Trash/{files,info}`) — not the full multi-filesystem spec
(`$topdir/.Trash-$uid` for other mounted volumes). A cross-device move
(`EXDEV`) falls back to recursive copy-then-delete instead. Takes the
trash's base directory as a constructor parameter, same reasoning as
`HistoryStore` taking an explicit file path: tests point it at a throwaway
temp directory instead of writing into the developer's real trash.

## How this reaches the user: extends the existing confirm dialog, not a separate feature

PLAN.md §4.9 describes preview and trash as part of the same safety net as
the destructive-command confirmation already built in phase 1 — so rather
than a standalone "preview" UI, `ConfirmDestructiveDialog` (phase 1) gains,
for `rm`/`mv` specifically:
- The resolved file list from `preview.service.ts`, shown inline instead
  of a plain command string.
- A third choice alongside Cancelar/"Ejecutar de todas formas": "Mover a
  la papelera" — only for `rm` (moving doesn't need a trash alternative,
  it already preserves the file).

Choosing "Mover a la papelera" never sends the typed command to the real
shell at all. Instead: the renderer clears the shell's current input line
(Ctrl+U) so the literal `rm ...` never executes, calls
`trashService.moveToTrash()` directly over IPC, and prints a local
confirmation line straight into the xterm.js display (not sent to the pty
— purely a client-side `terminal.write()`, the same mechanism used for the
"[shell exited]" message) with an inline "Deshacer" action that calls
`restoreFromTrash()`. This deliberately bypasses `HistoryStore` — a trash
move isn't a shell command, so it doesn't belong in the command diary.
