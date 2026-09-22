# Deciding what each help level actually hides

**Date:** 2026-09-22
**Phase:** Phase 2

## Problem

PLAN.md and the original brief say the help level affects "cuánto texto
muestra el copiloto, si el mapa es visible, cómo se comporta la IA" — true
in spirit, but not specific enough to implement directly. Something had to
decide, concretely, what each of the 3 levels does to each panel.

## Decision

| Panel | High | Medium | Low |
|---|---|---|---|
| Danger badge (semaphore) | always shown, with reason | always shown, with reason | always shown, **no reason text** |
| Subtitles breakdown | full (summary + every token explained) | summary only | hidden entirely (note instead) |
| Error card | explanation + suggestion | explanation only | hidden (just "a command failed") |
| Filesystem map | visible | visible | hidden entirely |
| History diary | label + raw command | label + raw command | raw command only |
| Destructive-command confirmation | **always blocks Enter, at every level** |

## Why the danger badge and confirmation dialog are never gated

Everything else in this table is pedagogical scaffolding — the whole point
of the help-level slider is that a beginner needs it and an experienced
user doesn't, so it's supposed to retire. The destructive-command
confirmation is not scaffolding, it's the safety net (PLAN.md's own
phrasing: "red de seguridad"). An experienced user is not less likely to
accidentally type `rm -rf /` — if anything a fast typist backspacing
through a long recursive delete is exactly the kind of person a "casi
terminal normal" tool should still catch. Turning that off at low help
would mean the app's core safety promise quietly disappears exactly when
it looks most like a real terminal — the opposite of what the andamiaje
concept is supposed to do. So `danger-classifier.ts`'s output always
reaches the terminal border and the confirm dialog unfiltered; only the
*explanatory text around it* shrinks as help level drops.

## Why the filesystem map is a hard on/off, not three levels of detail

Explicitly called out in the brief ("si el mapa es visible" — phrased as a
binary). Also just the most legible of the three UI states: an experienced
user working in a real terminal doesn't want a sidebar tracking every `cd`
at all, whereas the subtitles/errors panels are useful in *some* reduced
form even for someone reasonably comfortable with the shell (the summary
line, or knowing a command failed).
