# Non-TS assets the main process reads from disk (shell-init scripts, grammar)

**Date:** 2026-09-22
**Phase:** Phase 1

## Problem

`PtySession` reads the bash/zsh integration scripts from `shell-init/`, and
`bash-parser.ts` loads `grammars/tree-sitter-bash.wasm`, both via plain
`fs`/Node path resolution at runtime (not via `import`, since one is shell
script text and the other is a binary blob `web-tree-sitter` reads with
`fs.readFile`).

electron-vite bundles the whole main process into a single
`out/main/index.js` via Vite/Rollup. That means `import.meta.url` inside
that bundle always points at `out/main/`, **not** at wherever the original
source file (`src/main/pty/pty-session.ts`,
`src/main/command-analysis/bash-parser.ts`) lived. A path built as
`path.resolve(moduleDir, '..', '..', 'grammars', ...)` — correct if you
naively mirror the source tree's depth — silently breaks once bundled.

## Decision

- Both files resolve their assets as **direct children** of `moduleDir`
  (`path.join(moduleDir, 'shell-init')`,
  `path.join(moduleDir, 'grammars', 'tree-sitter-bash.wasm')`), assuming
  `moduleDir` is always `out/main/` — true both in `electron-vite dev` and
  in a full build, since main/preload are never served in-memory the way
  the renderer is.
- `electron.vite.config.ts` uses `vite-plugin-static-copy` on the `main`
  config to copy `src/main/pty/shell-init/**/*` → `out/main/shell-init/`
  and `grammars/tree-sitter-bash.wasm` → `out/main/grammars/` on every
  build, so the files those paths expect actually exist there.

## Gotcha for future changes

If either directory moves, or a new asset like this is added, it needs a
matching `viteStaticCopy` target — there's no automatic detection. The glob
`shell-init/**/*` does pick up dotfiles (`.zshenv`, `.zshrc` under
`zsh-zdotdir/`) because the plugin hardcodes `dot: true` internally;
verified by reading its bundled source rather than assuming.

## Two more vite-plugin-static-copy gotchas found by actually running the build

Running `electron-vite build` and inspecting `out/` (rather than trusting
the config looked right) turned up two real bugs, both only visible at
runtime:

1. **The plugin silently copied nothing at all.** `vite-plugin-static-copy`
   defaults to `environment: 'client'` and checks
   `this.environment.name !== environment` before running — but
   electron-vite builds main/preload as an environment literally named
   `"ssr"` (visible in the build log: "building ssr environment for
   production"). Confirmed by adding a throwaway probe plugin that logged
   `this.environment.name`. Fix: pass `environment: 'ssr'` explicitly in
   the `viteStaticCopy({...})` options for the `main` config.

2. **Once it did run, it preserved the wrong directory structure.** The
   plugin mirrors each matched file's full path *relative to the project
   root* under `dest` — so `src/main/pty/shell-init/**/*` with
   `dest: 'shell-init'` produced
   `out/main/shell-init/src/main/pty/shell-init/...` (the whole source path
   nested again inside itself), and `grammars/tree-sitter-bash.wasm` with
   `dest: 'grammars'` produced `out/main/grammars/grammars/...`. Fixed with
   `rename: { stripBase: N }`, where `N` is the number of path segments
   (relative to the project root) to cut from the front — 4 for
   `"src/main/pty/shell-init"`, 1 for `"grammars"`. Verified by reading
   `collectCopyTargets`/`applyRenameObject` in the plugin's bundled source
   to understand what `stripBase` actually counts, then checking the real
   output tree matched (`out/main/shell-init/shellmate.bash`,
   `out/main/shell-init/zsh-zdotdir/.zshrc`,
   `out/main/grammars/tree-sitter-bash.wasm`).

Both were invisible from the config alone — the plugin fails silent-ok
(`environment` mismatch) or silently-wrong (unwanted nesting) with an
`electron-vite build` that still reports success either way. Same fix
lesson as `bash-parser.ts`'s grammar path from the section above: don't
trust a plausible-looking path or config, run the actual build and read
the actual output tree.

## `package.json`'s `main` field: also wrong until checked against real output

Reasoned (before ever running a real build) that since `package.json` has
`"type": "module"` and Electron 44 supports ESM, electron-vite would build
**both** main and preload with `entryFileNames: '[name].mjs'`, so `main`
should point at `./out/main/index.mjs`. Running the actual build showed
that's only true for **preload** (`out/preload/index.mjs`) — main comes out
as `out/main/index.js`, despite genuinely being ESM syntax inside (`import`,
`import.meta.url`). It still runs correctly as ESM because Node resolves
module type by walking up from the file to the nearest `package.json`,
finds `"type": "module"` at the project root, and doesn't care that the
immediate file extension is `.js` rather than `.mjs`. Fixed `main` to
`./out/main/index.js` to match what electron-vite actually emits, rather
than what reading its source suggested it should emit.

## Known gap

This only makes `electron-vite dev` and `electron-vite preview` work
correctly. Packaging with `electron-builder` (deferred, see PLAN.md) will
need its own `extraResources`/`files` config pointing at these same
`out/main/shell-init` and `out/main/grammars` paths, or an asar-unpack rule
— not addressed yet.
