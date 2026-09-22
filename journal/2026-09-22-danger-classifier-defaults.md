# Calibrating the deterministic danger classifier's defaults

**Date:** 2026-09-22
**Phase:** Phase 1

## Decisions

1. **Unknown commands default to `caution`, not `safe`.** The dictionary
   only covers ~48 commands; anything else (`docker`, `npm`, `vim`, a custom
   script...) is unclassified. Defaulting to `safe` would silently hide real
   risk for anything outside the dictionary. Defaulting to `caution` means
   the semaphore leans protective when it doesn't know — the right bias for
   a tool whose whole purpose is protecting inexperienced users, even though
   it means plenty of harmless, common tools show amber. The reason string
   always says *why* ("not in our dictionary"), so it doesn't read as an
   opaque warning.

2. **Sensitive-path escalation only applies to commands that already modify
   something.** `ls /etc` or `find / -name x` stay `safe` even though `/etc`
   and `/` are in the sensitive-path list — reading a sensitive path isn't
   dangerous. The check only fires when the base level is already `caution`
   or higher (see `classifySegment` in `danger-classifier.ts`), so it can
   only make things *worse*, never invent risk for read-only commands.

3. **`rm`'s dictionary `baseDanger` is `caution`, not `destructive`.**
   Originally set to `destructive` directly in `data/commands.json`, which
   would flag `rm one-file.txt` as destructive — too aggressive, and it
   defeats the point of having a separate escalation rule for `-r`/`-rf`.
   Now: plain `rm file` is `caution` (deletes a named file, no undo yet —
   that's phase 3's trash integration); `rm -r`/`-rf` on a directory
   escalates to `destructive` via an explicit rule in `danger-classifier.ts`,
   with a reason that mentions `-f` specifically when both flags are
   present.

4. **`rmdir`'s `baseDanger` is `safe`, not `caution`.** GNU `rmdir` refuses
   to remove a non-empty directory — it can't cause the kind of accidental
   data loss the danger levels are meant to flag. (Also: it has no `-r`
   flag, so it's excluded from the recursive-flag escalation rule entirely,
   unlike an earlier draft that grouped it with `rm`.)

5. **Recursive/force flag detection uses an explicit letter-cluster check,
   not a loose regex.** An earlier draft used
   `/^-\w*[rR]\w*$/` to detect `-r`/`-rf`/etc., which also matches
   `--no-preserve-root` (contains "r", not a recursive flag) as a false
   positive. Replaced with `isShortFlagCluster()`: long (`--`) options are
   only matched against an explicit allowlist (`--recursive`, `--force`),
   while short flags (`-r`, `-rf`, `-irf`, ...) are matched by checking if
   the cluster includes the letter — accurate for how GNU `rm`'s actual flag
   set works.

## Known limitation

Sensitive-path detection is intentionally narrow (`/`, bare `~`, a bare
`*`, and a handful of top-level system directories like `/etc`) — it won't
catch e.g. `rm /etc/passwd` (a specific sensitive *file*, not a whole
sensitive directory). Widening this reliably without a lot of false
positives needs more thought than phase 1's scope allows; revisit if it
turns out to matter in practice.
