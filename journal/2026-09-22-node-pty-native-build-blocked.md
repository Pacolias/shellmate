# node-pty requires gcc-c++, not available by default

**Date:** 2026-09-22
**Phase:** Phase 1

## Context

`node-pty` has no prebuild for this environment (Fedora, Node 22.22.2, x64)
and falls back to compiling the native addon with `node-gyp rebuild`. The
build fails:

```
make: g++: No such file or directory
```

The system has `gcc`, `make` and `python3`, but is missing `gcc-c++` (the
package that provides `g++`/`c++` on Fedora).

## Decision

Asked the project owner whether to install `gcc-c++` via
`sudo dnf install -y gcc-c++` (a system-level change outside the repo, so
confirmation was requested instead of running it directly). They preferred
to install it themselves.

## Status

Blocked on `npm install` until `gcc-c++` is available. Command the owner can
run whenever they want:

```
sudo dnf install -y gcc-c++
```

Then re-run `npm install` at the project root.
