# Phase 1: first real run, end to end

**Date:** 2026-09-22
**Phase:** Phase 1

## Electron's binary didn't download on the first `npm install`

After `npm install` completed cleanly (0 vulnerabilities, no visible
errors), `npm run dev` failed immediately with `Error: Electron uninstall`
from electron-vite. `node_modules/electron/` had its JS wrapper but no
`dist/` and no `path.txt` — the package's own postinstall script (which
downloads the actual Electron binary from GitHub releases) never
completed, without surfacing an error loud enough to notice in the
install output.

Fix: `node node_modules/electron/install.js` run directly completed the
download and fixed it — no error output the second time either, it just
worked. Likely a transient network hiccup during the original install.
Noting this in case it recurs: if `npm run dev`/`build` complains about a
missing Electron binary despite `npm install` reporting success, re-run
that install script directly before assuming something is actually wrong
with the app.

## First full end-to-end verification

No project running-skill existed yet, so the app was driven manually:
built the real Electron binary, launched it with Playwright's `_electron`
API (`node_modules/electron/dist/electron` directly, `--no-sandbox`,
pointed at the project root so it reads `package.json`'s `main`), and
drove it — this machine has a real X/Wayland display (`DISPLAY=:0`), so no
`xvfb` was needed. `playwright-core` was installed with `--no-save` purely
for this verification and removed again afterward; it is **not** a project
dependency.

Confirmed, with screenshots at each step:

1. The window opens with the three-column layout intact, phase 2/3 panels
   showing their `ComingSoon` empty states correctly.
2. The terminal pane shows a real shell prompt from the user's actual zsh
   config (their own prompt customization and syntax-highlighting plugin
   both render correctly — the injected `shellmate.bash`/zsh hooks aren't
   interfering with the user's real setup, which was the whole point of
   sourcing their rc file first).
3. Typing `rm -rf /` colors the terminal frame red **while typing**,
   before Enter — the live danger semaphore. The subtitles panel updates
   in lockstep: `DESTRUCTIVO` badge, `rm` and `-rf` explained, `/` flagged
   as a sensitive path.
4. Pressing Enter does **not** run the command — `ConfirmDestructiveDialog`
   appears with the exact command, the reason, and Cancel/"Ejecutar de
   todas formas" — matching PLAN.md §4.2's requirement that a destructive
   command block Enter until explicitly confirmed.

This is the core phase 1 safety-net flow (semaphore → subtitles → blocked
confirmation) working end to end, not just typechecking/unit-testing
clean. The `run` skill's guidance to actually drive the app rather than
trust the build turned out to matter twice already this phase (this, and
the `vite-plugin-static-copy` bugs that `electron-vite build` alone never
would have surfaced by exit code).
