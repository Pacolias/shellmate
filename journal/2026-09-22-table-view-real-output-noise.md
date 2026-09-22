# "View as table" broke on real output — ANSI codes and another shell hook's noise

**Date:** 2026-09-22
**Phase:** Phase 3

## What happened

`table-parsers.ts`'s first version passed a clean synthetic test suite but
never once matched real `ls -l` output when actually run in the app. Found
by adding a temporary debug log to `TerminalPane`'s
`onCommandFinished` and inspecting what was really captured — not by
reasoning about it in the abstract.

Two real problems in the captured text, neither present in my synthetic
test fixtures:

1. **Color codes.** This system's `ls` resolves through a `--color=auto`
   alias (extremely common — Fedora, most distros), so real output looks
   like `\x1b[01;34mfoldername\x1b[0m`, not plain text. A naive
   whitespace-split still mostly works (the escape codes don't contain
   spaces), but they pollute the captured filename.

2. **Another shell-integration hook's output, in the same capture.** This
   was the surprising one. The user's zsh has its own `precmd` hook (a
   themed prompt, plus VTE's own OSC 666 shell integration) registered
   *before* ours (`shellmate.zsh` sources the user's real `.zshrc` first,
   then adds our hook — see `journal/2026-09-22-command-capture.md`). Hooks
   run in registration order, so the user's own hook's output — a prompt
   marker, `\x1b]666;vte.shell.postexec=0\x1b\\` — lands in the captured
   text *between* the real command output and our own `133;D` marker. Our
   capture window (`RecentOutputTracker` in main, and the equivalent
   client-side buffer in `useTerminal.ts` for this feature) has no way to
   know where "real command output" ends and "someone else's prompt
   drawing" begins — it just captures everything between our own start/end
   markers.

## Fix

`table-parsers.ts` now:
- Strips ANSI CSI and OSC sequences before parsing anything
  (`stripAnsi()`).
- Every parser treats each line independently against a strict structural
  pattern (a real unix permission string for `ls -l`; a real header shape
  for `ps`/`df`) and **skips** non-matching lines instead of failing the
  whole table on the first line that doesn't fit. A table is only offered
  if at least one row actually matched.

This is more than defensive coding for its own sake — it's the direct fix
for a capture mechanism that can never fully control what ends up between
its own markers when other hooks share the same precmd/preexec cycle. The
same reasoning likely explains why `error-catalog.ts` matching (phase 1)
never surfaced this: regex `.test()` doesn't care about extra
surrounding noise, only line-based structural parsing does.

## Also fixed while here: `free` was never going to work

`free`'s output prefixes each row with a label (`Mem:`, `Swap:`) that
isn't one of the header's own columns — the opposite shape from
`ps`/`df`, where overflow lands at the *end* via a wider last column.
Dropped `free` from the supported commands rather than half-support it
with wrong columns; PLAN.md §4.8 says "unrecognized command → no button,
no invented structure" and that applies just as much to a command we
recognize but can't actually model correctly.

## Verified for real afterward

Re-ran the same live check with the fix in place:
`ls -l /tmp` (with color codes and trailing VTE noise, for real, on this
machine) → "Ver como tabla" appeared and rendered a correct, sortable
table. `ps aux`-style header (`%CPU`/`%MEM`, tested directly since no
long-running process was worth spawning) parses correctly too.
