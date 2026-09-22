# The danger classifier never saw output redirects — fixed while building pipeline preview

**Date:** 2026-09-22
**Phase:** Phase 3

## The bug

`bash-parser.ts` only ever captured a `command` node's `name` and
`argument` fields into tokens. Redirects (`> file`, `>> file`) were never
extracted at all — so `echo hello > /etc/passwd` classified exactly like
`echo hello`: **safe**, green border, no confirmation. The danger
classifier had a blind spot for every redirect-based write since phase 1;
it just never got exercised until now.

## Why it surfaced now

Building `pipeline-preview.service.ts` (re-executing a pipeline in the
background when every stage is classified `safe`) meant a misclassified
redirect wasn't just a display bug anymore — it could make the preview
feature itself silently perform a real write the user only asked to
*preview*. That risk is what prompted actually checking, rather than the
gap being found by inspection.

## Root cause, once found

Two things needed fixing, discovered by dumping the actual parse tree
(`web-tree-sitter`) for `echo hello > /etc/passwd`, not by trusting the
grammar's field documentation:

1. A **trailing redirect wraps the command in a `redirected_statement`
   node**, with the redirect as *that* node's child — not the `command`
   node's own `redirect` field (which only fires for other syntactic
   shapes). `bash-parser.ts`'s `collectRedirectNodes()` now checks both.
2. Once captured, the token still had to reach `danger-classifier.ts`. A
   write redirect (`>`, `>>`, `&>`, ...) now escalates to at least
   `caution` regardless of the base command's own danger level, and its
   target is checked against the same sensitive-path patterns positional
   arguments already were (`echo x > /etc/passwd` → destructive). Read
   redirects (`<`, `<<<`) are left alone — they don't write anything.

## Related: widened the sensitive-path patterns

The existing patterns only matched sensitive *directories* (`/etc` itself,
not a file inside it) — fine for `rm`/`chmod` targets, which are often
directories, but redirects overwhelmingly target specific *files*.
Added `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`, `/etc/hosts`,
`/etc/fstab` as exact matches. Still a curated list, not a general rule —
consistent with the existing "known limitation" noted in
`journal/2026-09-22-danger-classifier-defaults.md`.

## Tests

`test/unit/bash-parser.test.ts` and `test/unit/danger-classifier.test.ts`
both got redirect-specific cases (parsed as `redirect` tokens; write vs.
read; sensitive vs. ordinary target; `>>` treated the same as `>`).
