# Pipeline preview: safety constraints and their tradeoffs

**Date:** 2026-09-22
**Phase:** Phase 3

## Why re-execution is gated so hard

A real terminal never shows intermediate pipeline output — only the last
stage's stdout ever reaches the pty (`ps aux | grep node` shows just
`grep`'s output; `ps`'s full listing goes straight through an OS pipe,
never touching the terminal). The only way to show it for real is to run
the pipeline again, separately, in the background. Confirmed with the
user before building this (re-execution risk is real: a modifying command
run twice can do real damage, e.g. `curl url | sh`, `mv * done/ | log`).

Landed on: **only re-execute when `danger-classifier.ts` rates every
single stage `safe`** (read-only). `previewPipeline()` in
`pipeline-preview.service.ts` refuses (`status: 'not-eligible'`) for
anything else — no partial preview, no "preview the safe stages only".

## Consequence: unrecognized commands make a pipeline ineligible

`danger-classifier.ts` defaults unrecognized commands to `caution`, not
`safe` (see `journal/2026-09-22-danger-classifier-defaults.md`). That bias
was chosen for the semaphore's sake, but it applies here too since
pipeline preview reuses the exact same classifier — so a pipeline using
any command outside the ~48-entry dictionary (`sort`, `awk`, `sed`, `wc`,
`cut`, `printf`, `uniq`, ... none of which are in `data/commands.json`)
is never eligible for preview, even though most of those are genuinely
read-only.

Decided to accept this rather than special-case pipeline preview with a
looser rule: the whole point of gating on `safe` is "don't re-execute
anything we're not sure about," and a command outside the dictionary is
by definition something we're not sure about. Loosening it specifically
for preview would mean the feature has a *weaker* safety bar than the
semaphore does, which defeats the reason it's gated at all.

## Other constraints

- Runs via `/bin/bash -c <stage>`, not the interactive pty — a stage's
  reconstructed command line (`tokens.map(t => t.text).join(' ')`) is
  spawned as a background `child_process`, in the same `cwd` as the real
  shell session (tracked via `current-session-state.ts`, the same
  mechanism the AI copilot's cwd context uses).
- 5 second timeout per stage, 4000-character output cap — a hung or
  chatty command can't block or flood the preview.
- Token reconstruction now includes redirect tokens too (see
  `journal/2026-09-22-redirect-danger-gap.md`), so a stage with `2>&1` or
  similar round-trips correctly instead of silently dropping it.
