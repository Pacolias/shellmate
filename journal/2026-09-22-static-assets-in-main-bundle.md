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

## Known gap

This only makes `electron-vite dev` and `electron-vite preview` work
correctly. Packaging with `electron-builder` (deferred, see PLAN.md) will
need its own `extraResources`/`files` config pointing at these same
`out/main/shell-init` and `out/main/grammars` paths, or an asar-unpack rule
— not addressed yet.
