# Grammars

`tree-sitter-bash.wasm` is the precompiled Bash grammar for
[`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter), vendored
straight from the official
[`tree-sitter-bash`](https://www.npmjs.com/package/tree-sitter-bash) npm
package (version `0.25.1`), which ships a prebuilt WASM binary alongside its
native bindings.

It's vendored here instead of pulled in as a runtime dependency because:

- We only need the `.wasm` grammar file, not the native Node bindings that
  package also ships (those require compiling a native addon, see
  `journal/2026-09-22-node-pty-native-build-blocked.md` for why we'd rather
  avoid an extra native build when we can).
- Committing a ~1.3 MB binary asset is simpler than wiring up a postinstall
  step to extract it from `node_modules` on every fresh clone.

`tree-sitter-bash.LICENSE.txt` is that package's MIT license, kept alongside
the binary for attribution.

To upgrade the grammar: `npm pack tree-sitter-bash@latest`, extract the
tarball, and replace `tree-sitter-bash.wasm` with the new one.
