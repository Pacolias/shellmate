# Build tooling: electron-vite instead of a hand-rolled setup

**Date:** 2026-09-22
**Phase:** Phase 1

## Decision

Using `electron-vite` to orchestrate the three bundles (main, preload,
renderer) instead of hand-writing a single `vite.config.ts` + separate
`tsc` compilation for main/preload + `concurrently`/`wait-on` for dev mode,
which is what PLAN.md implicitly suggested (`vite.config.ts` plus
`tsconfig.main.json`/`tsconfig.preload.json`).

Resulting structure (matches what's already planned in PLAN.md §3):

```
src/main/       → compiled by electron-vite ("main" config)
src/preload/    → compiled by electron-vite ("preload" config)
src/renderer/   → Vite + @vitejs/plugin-react ("renderer" config)
electron.vite.config.ts
tsconfig.node.json   (main + preload)
tsconfig.web.json    (renderer)
```

## Why

`electron-vite` gives real HMR in the renderer, a single command
(`electron-vite dev`) that boots main+preload+renderer with automatic reload
of the main process on code changes, and coherent production builds.
Hand-rolling this with `concurrently`+`wait-on` is more build-plumbing code
for the same result, and this is a portfolio project where engineering time
should go to the modules, not the build plumbing.

## Version conflicts resolved (npm install)

Pinning "latest" versions all at once caused peer-dependency conflicts:

- `electron-vite@5.0.0` only supports `vite ^5 || ^6 || ^7` → downgraded from
  Vite 8.3.0 to **Vite 7.3.6**.
- `@vitejs/plugin-react@6.1.1` requires `vite ^8` → downgraded to
  **`@vitejs/plugin-react@5.2.0`** (supports vite 7 and 8).

With those two fixes, `npm install` resolves cleanly, no
`--legacy-peer-deps` or `--force` needed.
