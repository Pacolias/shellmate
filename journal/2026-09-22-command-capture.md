# Capturing command text and pushing translated errors from main

**Date:** 2026-09-22
**Phase:** Phase 1

## Problem

PLAN.md §4.4 describes translated errors as: the renderer gets
`CommandFinished(exitCode≠0)`, then asks main to look the error up over
IPC, passing `stderr`. Two things that sentence glosses over turned out to
matter once actually building it:

1. **Main never captured the command's raw text.** OSC 133;C (command
   start) carries no payload in the base spec — it's just a boundary
   marker. Something had to capture *what* command actually ran, for the
   error catalog's per-command scoping (`commands: ["git"]` entries) to
   work at all.
2. **There's no real "stderr" to hand over.** A pty merges stdout and
   stderr into one stream, like any real terminal — there's no clean way
   for the renderer to extract "just the error output" for the command
   that just failed, short of re-parsing everything itself.

## Decisions

1. **The shell hooks now send the command text, base64-encoded, in OSC
   133;C's payload.** Bash: `$BASH_COMMAND` in the DEBUG trap. Zsh:
   `preexec`'s `$1` (zsh has this natively, no trap hackery needed).
   Base64 sidesteps every quoting/escaping question — arbitrary shell text
   (quotes, newlines, unicode) round-trips safely through an OSC payload
   that's terminated by BEL. `osc-parser.ts` decodes it back into
   `CommandStartedEvent.command`.

2. **Main tracks a rolling output buffer itself and pushes the result,
   instead of waiting for the renderer to ask.** `RecentOutputTracker`
   (capped at 8000 chars) resets on `command-started`, accumulates every
   plain-data chunk from `OscStreamParser`, and gets read on
   `command-finished` with a non-zero exit code. `pty.handlers.ts` then
   calls `error-catalog.ts` itself and pushes a new `command:failed` event
   with `{ command, exitCode, rawOutput, match }`.

   This replaced the originally-planned `error:lookup` invoke channel
   entirely — removed from `ipc-contract.ts` and `bridge-api.ts`, along
   with `src/main/ipc/error.handlers.ts`, since nothing calls it anymore.
   `error-catalog.ts`'s `lookupError()` itself is unchanged and still has
   its own unit tests; only *who calls it and when* moved.

## Why main owns the buffer instead of the renderer

The renderer already receives every `pty:data` chunk (it has to, for
xterm.js), so it technically *could* keep its own rolling buffer instead.
Main does it anyway because:

- It keeps the "single source of truth for parsing, classification, local
  data access" principle (PLAN.md §5) intact for this flow too — the
  renderer only ever renders a `CommandFailedEvent` it's handed, it never
  reasons about raw output itself.
- Main already needs to track `lastCommand` for `extractCommandName()`
  (unwrapping `sudo`, same idea as the danger classifier); tracking the
  matching output buffer right next to it is one small class, not a
  second parallel state machine in the renderer.
