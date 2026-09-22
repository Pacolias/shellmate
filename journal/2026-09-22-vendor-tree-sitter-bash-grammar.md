# Vendoring the tree-sitter-bash WASM grammar instead of adding it as a dependency

**Date:** 2026-09-22
**Phase:** Phase 1

## Decision

`grammars/tree-sitter-bash.wasm` is committed straight into the repo,
extracted from the official `tree-sitter-bash` npm package (`0.25.1`),
instead of adding a runtime dependency to fetch it.

## Why

Two options were considered to get a prebuilt Bash grammar for
`web-tree-sitter`:

1. **`tree-sitter-wasms`** — bundles prebuilt WASM grammars for ~30
   languages, 51.8 MB unpacked. Massive overkill just to get one grammar.
2. **`tree-sitter-bash`** (the official package) — ships both native Node
   bindings (needs `node-gyp-build`, which needs a matching prebuild or a
   C++ toolchain) *and* a prebuilt `tree-sitter-bash.wasm` we don't need the
   native part for.

Neither is worth a permanent `package.json` entry for a single static
binary asset that basically never changes. So: extract the `.wasm` once
(`npm pack tree-sitter-bash@0.25.1`, untar, copy the file out) and vendor it
like any other binary asset (a font, an icon). `grammars/README.md`
documents where it came from and how to upgrade it later.

## Why not just add `node-pty`-style native compilation instead

`tree-sitter-bash`'s own install script (`node-gyp-build`) only falls back
to compiling with `node-gyp` when no matching prebuild exists for the
current platform/arch/Node ABI. It does have a `prebuilds/linux-x64`
directory, so it likely would have installed cleanly here even without
`gcc-c++` — unlike `node-pty`, which has no matching prebuild in this
environment (see
`journal/2026-09-22-node-pty-native-build-blocked.md`). That's somewhat
orthogonal to this decision, but worth noting: vendoring the `.wasm` avoids
depending on that behavior at all, for either package.
