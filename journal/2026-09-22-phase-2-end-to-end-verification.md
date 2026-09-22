# Phase 2: end-to-end verification

**Date:** 2026-09-22
**Phase:** Phase 2

Same manual approach as phase 1's verification (Playwright's `_electron`
against the real built app, no xvfb needed — this machine has a real
display). Confirmed, with screenshots:

1. **Filesystem map**: shows the real root (`/afs`, `/boot`, `/dev`, `/etc`,
   `/home`...), lazily loading each level on expand. Running `cd /tmp && ls`
   moved the 📍 indicator to `/tmp` automatically, no manual clicking
   through the tree.
2. **History diary**: the same command recorded a "Últimos comandos" entry
   labeled "Cambia el directorio de trabajo actual. → Lista los archivos y
   carpetas de un directorio." — confirming `deriveHistoryLabel` correctly
   joins per-segment summaries for a `&&` chain, reusing the same
   annotation the subtitles panel uses.
3. **Save as recipe → run recipe**: named the entry "ir a tmp", it appeared
   under "Recetas guardadas" with an "Ejecutar" button. Clicking it
   inserted `cd /tmp && ls` into the terminal's current line — visibly
   *not* auto-submitted — and the subtitles panel reacted live (SEGURO
   badge, `cd`/`/tmp` breakdown), confirming `insertText` really does go
   through the same `handleInput` path as typing, not a shortcut around it.
4. **Help level slider**: switching to "Bajo" hid the filesystem map
   (replaced with the "oculto a este nivel" note) and collapsed the
   subtitles panel to just the danger badge with no reason text — while
   the badge itself and the history diary's raw commands stayed visible,
   matching the design in
   `journal/2026-09-22-help-level-behavior.md`.

No new bugs surfaced this time — phase 1's `run`-skill lesson (verify by
actually driving the app, not just by a clean build) mostly paid for
itself already; this run was confirmation, not discovery.
