# Phase 3: end-to-end verification

**Date:** 2026-09-22
**Phase:** Phase 3

Same approach as phases 1 and 2 (Playwright's `_electron` against the real
built app, real display, no mocking). This pass caught two real bugs that
unit tests alone didn't — both already fixed and covered by new tests, see
their own journal entries
(`journal/2026-09-22-redirect-danger-gap.md`,
`journal/2026-09-22-table-view-real-output-noise.md`). What's confirmed
working end to end, with screenshots, after those fixes:

1. **Cheatsheet**: typing `ls` shows its real examples
   (`ls`, `ls -la`, `ls -lh /home`) and flag chips from the dictionary.
   Clicking the `-la` chip appended it to the terminal's current line via
   the same `insertText` path recipes use.

2. **Pipeline view**: `echo hello world | grep hello` (both dictionary-safe
   commands) showed the "Ver vista de tuberías" button; clicking it
   re-executed each stage in the background and displayed **real**
   intermediate output per stage (`hello world` after `echo`, `hello
   world` again after `grep hello`) — confirming the background
   re-execution and per-stage capture actually works, not just that the
   button renders.

3. **Table view**: `ls -l /tmp`, run for real (with this system's actual
   `ls --color` alias and this user's actual zsh theme/VTE integration
   both contributing noise to the captured output), rendered a correct,
   sortable table after the ANSI-stripping/skip-bad-lines fix.

4. **Natural language panel**: with no `GEMINI_API_KEY` set, shows the
   setup instructions (env var name) instead of a broken/empty panel —
   the only piece of phase 3 not verified against a real AI call (see
   `journal/2026-09-22-ai-provider.md`).

5. **Trash flow**: `rm -rf borrame` (a real directory with a real file
   inside, in a throwaway temp dir) triggered the destructive-confirmation
   dialog with the resolved path listed (preview.service.ts). Clicking
   "Mover a la papelera" moved it for real, cleared the now-stale typed
   command from the shell's input line, and showed a success view with
   "Deshacer". Clicking "Deshacer" restored both the directory and the
   file inside it — verified afterward on the real filesystem
   (`existsSync` both returned `true` post-undo), not just via the UI.

Help level gating (from phase 2) continues to apply correctly to the new
panels — not re-verified per-level here since the mechanism itself
(`useHelpLevel`) is unchanged and already covered.
