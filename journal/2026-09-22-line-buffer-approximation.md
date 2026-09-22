# The renderer's input-line tracker is an approximation, not a line editor

**Date:** 2026-09-22
**Phase:** Phase 1

## Context

The danger traffic light and subtitles need to know "what does the current
input line say" as the user types, to send to `command:analyze`. xterm.js's
`terminal.onData` only gives raw keystrokes being sent toward the shell —
it doesn't expose "the current line" as a string, because xterm.js is a
terminal emulator, not a line editor (the actual line editing happens in
the real shell via readline/zle, which we don't have visibility into from
the app side).

## Decision

`src/renderer/src/modules/terminal/line-buffer.ts` implements a small,
pure, testable approximation (`applyKeystroke`): append printable
characters, handle backspace and Ctrl+C/Ctrl+U as "clear line", treat
Enter as "submitted", and ignore escape sequences (arrow keys, etc.)
entirely.

## Known limitation

It does **not** track cursor position. If the user moves the cursor with
arrow keys and edits mid-line (common in real shell usage — fixing a typo
earlier in a long command), our tracked buffer silently drifts from what
the real shell sees, since we just ignore the arrow-key escape sequences
and any inserts/deletes that follow would append at the wrong logical
position.

Accepted for phase 1: the target audience (people without deep terminal
experience) mostly types linearly and backspaces, rather than using
readline's cursor-movement shortcuts. If this turns out to matter in
practice, the real fix isn't a smarter local emulator — it's asking the
shell what the line actually is (bash has no clean hook for this
mid-composition; zsh's `zle` could expose it via a custom widget). Revisit
if needed.
