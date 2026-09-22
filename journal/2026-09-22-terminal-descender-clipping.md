# Terminal glyph descenders (p/g/j/q/y) were being clipped

**Date:** 2026-09-22
**Phase:** Phase 1 (terminal pane)

## Symptom

Descenders on `p`, `g`, `j`, `q`, `y` were visibly cut off at the bottom in
the terminal pane — reported first as "any letter with a tail", narrowed
down over several rounds of live testing to specifically the `g`.

## Root cause

xterm.js's default `lineHeight` (1) sizes each row's cell height to
`floor(measuredCharHeight * lineHeight)`, and each row is a DOM element
with `overflow: hidden` — any glyph pixel past that computed height is
hard-clipped, not just visually truncated. This system doesn't have any
of the preferred fonts in `--font-mono` installed, so Fontconfig falls
back to Noto Sans Mono, whose descenders need more headroom than the
default ratio provides.

## Two rounds, because the first fix was under-tested

`lineHeight: 1.2` wasn't enough — confirmed with real typed input, not
just a static screenshot (a screenshot of a line with nothing below it
doesn't prove anything either way, since a clipped pixel and an
unclipped-but-background-colored pixel look identical in a still image;
what actually distinguishes them is typing a second line afterward and
checking the first line's tail is still there).

Bumped to `lineHeight: 1.6`, swept 1.0/1.2/1.4/1.6/2.0 live, verified with
zoomed screenshots of **plain-weight echoed text** (`echo gggg jjjj yyyy
pppp`) — looked completely clean, no clipping on any of p/g/j/q/y. Shipped
it as the fix.

It wasn't. The user's own screenshot, taken from the real running app,
showed the `g` in `git` still clipped — while typing a *recognized shell
command*, not an `echo` output line. The difference: this project's shell
config has syntax highlighting that renders a valid command **bold** as
you type it. A bold glyph's strokes (and apparently its descender) sit
lower/thicker than the same glyph at regular weight — my sweep had only
ever tested plain-weight text, so it never exercised the actual failure
mode.

Reproduced directly: typed `git` in a real Electron window and zoomed into
the rendered `g` — clipped at 1.6, clean at 1.7 and 1.8. Shipped `1.7` (the
smaller of the two that fully fixed it), re-verified against both a bold
command (`git`) and plain descenders in the same line.

## Lesson

A visual fix isn't verified by testing the same rendering path twice with
different input values — it's verified by testing the *actual* rendering
paths the bug report came from. Plain-weight echoed text and
syntax-highlighted bold input text measure differently in xterm.js's
clipped-row layout; sweeping one and assuming it covers the other produced
a fix that looked complete and wasn't. When a user says "still happening"
after a fix that passed your own check, the right move is to get their
exact repro (a screenshot, in this case) rather than re-running the same
test more carefully.
