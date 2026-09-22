# ShellMate — Architecture Plan

> Desktop terminal for Linux, designed for people without technical experience.
> A real terminal (actual bash/zsh) surrounded by visual scaffolding that fades away progressively.
> Portfolio project: prioritizes clean, well-structured code and a polished UI over feature count.

## 1. Tech stack

| Piece | Choice | Why |
|---|---|---|
| App shell | Electron | We need a native process (node-pty), filesystem access, no browser sandbox restrictions |
| UI | React + TypeScript + Vite | Fast DX, strong typing, HMR |
| Terminal | xterm.js (renderer) + node-pty (main) | De facto standard; node-pty spawns a real shell |
| Command parsing | tree-sitter-bash (via `web-tree-sitter`, WASM) | A real bash parser, not fragile regex |
| AI | Configurable provider behind an `AiProvider` interface (Gemini by default, Anthropic as an alternative) | Only for natural language → command; never for danger classification. Whoever clones the repo picks the provider and key via environment variables |
| Trash | freedesktop.org spec (`~/.local/share/Trash/{files,info}`) | Integrates with the user's desktop environment |
| Tests | Vitest | Fast, Vite/TS-compatible, good ESM support |
| Packaging | electron-builder (later phase, non-blocking) | AppImage/deb for Linux |

The command dictionary, error catalog and danger rules are all **bundled local data** (JSON), no network required. AI is the only piece that depends on connectivity, and it's optional (with no key, the app works 100% except that panel).

## 2. Process architecture

Electron separates responsibilities naturally:

- **Main process** (Node.js): manages the pty (node-pty), the filesystem (directory map, trash, rm/mv preview), loading local data (dictionary, error catalog), and AI provider calls (the key never reaches the renderer). It's the only layer with access to Node APIs.
- **Renderer process** (React): UI only. Receives typed events over IPC and renders them. No direct access to fs/pty/network.
- **Preload script**: exposes a `contextBridge` with a minimal, typed API (`window.shellmate.*`) — contextIsolation on, nodeIntegration off in the renderer.
- **Typed IPC**: a single types file (`shared/ipc-contract.ts`) defines, channel by channel, the shape of every request/response/event, imported by both main and preload/renderer. No `any` in the bridge.

```
┌─────────────────────────────── Main process ───────────────────────────────┐
│  PtySession (node-pty)                                                     │
│    └─ emits raw data chunks + parsed OSC events                            │
│  ShellEventParser (OSC 133 / OSC 7)                                        │
│  DangerClassifier (deterministic rules)                                    │
│  CommandDictionary (local JSON)                                            │
│  ErrorCatalog (local JSON)                                                 │
│  FilesystemService (tree, rm/mv preview, freedesktop trash)                │
│  HistoryStore (diary + recipes persistence, JSON/lightweight SQLite)       │
│  AiService (configurable provider, optional, behind an interface)          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     │ Typed IPC (invoke/handle + events)
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                              Renderer (React)                               │
│  TerminalPane (xterm.js)     │  ContextColumn        │  CopilotColumn       │
│  - danger traffic light      │  - FilesystemMap       │  - Subtitles        │
│    while typing               │  - HistoryDiary        │  - ErrorCard        │
│  - rich output                │                        │  - Cheatsheet       │
│  - pipeline view              │                        │  - NaturalLanguage  │
│  HelpLevelSlider (cross-cutting, React Context, affects everything)         │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 3. Folder structure

```
shellmate/
├── PLAN.md
├── README.md
├── CLAUDE.md
├── package.json
├── electron-builder.yml               (later phase)
├── vite.config.ts
├── tsconfig.json  tsconfig.main.json  tsconfig.preload.json
├── vitest.config.ts
├── shared/                            # types and IPC contract, imported by main and renderer
│   ├── ipc-contract.ts
│   ├── types/
│   │   ├── command.ts                 # simplified AST, DangerLevel, ParsedCommand
│   │   ├── shell-events.ts            # PromptStart, CommandStart, CommandEnd, CwdChanged...
│   │   ├── history.ts
│   │   └── help-level.ts
│   └── i18n/
│       └── es.json                    # all UI text, centralized
├── src/
│   ├── main/
│   │   ├── index.ts                   # Electron bootstrap, BrowserWindow creation
│   │   ├── ipc/                       # one handler per domain, registers contract channels
│   │   │   ├── pty.handlers.ts
│   │   │   ├── filesystem.handlers.ts
│   │   │   ├── history.handlers.ts
│   │   │   └── ai.handlers.ts
│   │   ├── pty/
│   │   │   ├── pty-session.ts         # node-pty wrapper
│   │   │   └── shell-init/            # scripts injected when launching bash/zsh
│   │   │       ├── shellmate.bash
│   │   │       └── shellmate.zsh
│   │   ├── shell-events/
│   │   │   └── osc-parser.ts          # parses OSC 133 / OSC 7 from the pty stream
│   │   ├── command-analysis/
│   │   │   ├── bash-parser.ts         # tree-sitter-bash wrapper
│   │   │   ├── danger-classifier.ts   # deterministic rules
│   │   │   ├── command-dictionary.ts  # loads/queries data/commands.json
│   │   │   └── error-catalog.ts       # loads/queries data/errors.json
│   │   ├── filesystem/
│   │   │   ├── fs-tree.service.ts
│   │   │   ├── trash.service.ts       # freedesktop spec
│   │   │   └── preview.service.ts     # what a rm/mv would affect before running it
│   │   ├── history/
│   │   │   └── history.store.ts
│   │   └── ai/
│   │       ├── ai-provider.ts         # AiProvider interface (common contract)
│   │       ├── ai-service.ts          # picks provider from env var, never exposes the key to the renderer
│   │       └── providers/
│   │           ├── gemini.provider.ts     # AI_PROVIDER=gemini (default), GEMINI_API_KEY
│   │           └── anthropic.provider.ts  # AI_PROVIDER=anthropic, ANTHROPIC_API_KEY
│   ├── preload/
│   │   └── index.ts                   # contextBridge, minimal typed API
│   └── renderer/
│       ├── main.tsx  App.tsx
│       ├── app-state/
│       │   ├── HelpLevelContext.tsx   # global help level (cross-cutting)
│       │   └── ShellEventsContext.tsx # subscribes to pty IPC events
│       ├── modules/
│       │   ├── terminal/              # TerminalPane, traffic light, rich output, pipelines
│       │   ├── context-map/           # file tree + "you are here"
│       │   ├── history-diary/         # timeline + recipes
│       │   ├── copilot-subtitles/     # live command breakdown
│       │   ├── copilot-errors/        # translated error card
│       │   ├── copilot-cheatsheet/    # examples + flags as toggles
│       │   ├── copilot-natural-lang/  # natural language with training wheels
│       │   └── safety-net/            # preview + trash + undo (phase 3)
│       ├── layout/
│       │   ├── ThreeColumnLayout.tsx
│       │   └── HelpLevelSlider.tsx
│       └── theme/                     # design tokens, light/dark mode
├── data/
│   ├── commands.json                  # dictionary of 40-50 commands
│   └── errors.json                    # common error catalog
├── grammars/                          # tree-sitter-bash WASM
└── test/
    ├── unit/
    │   ├── osc-parser.test.ts
    │   ├── danger-classifier.test.ts
    │   ├── bash-parser.test.ts
    │   └── error-catalog.test.ts
    └── fixtures/
```

Each "helper" on the left/right side lives in `src/renderer/modules/<name>/` as a self-contained module (components + hooks + styles), consuming only the events it receives through `ShellEventsContext` and `HelpLevelContext`. No module talks to IPC directly except through dedicated hooks (`usePty`, `useFilesystem`, `useHistory`, `useAi`), which keeps the UI decoupled from Electron's details.

## 4. Modules and responsibilities

### 4.1 Shell integration (the foundation)
- `PtySession` (main): launches `node-pty` with the user's shell (`$SHELL`, falling back to bash), injecting an `--rcfile`/`ENV` that loads `shellmate.bash`/`shellmate.zsh`. These scripts:
  - Emit `OSC 133;A` (prompt start), `133;B` (prompt end / input start), `133;C` (execution start), `133;D;<exit_code>` (command end) via PROMPT_COMMAND/precmd/preexec hooks.
  - Emit `OSC 7` with `file://hostname/cwd` on every directory change.
  - Install non-invasively: they `source` the user's real rc file and append the hooks at the end, so they never break the user's existing config (aliases, PS1, plugins).
- `osc-parser.ts` (main): a stream parser that separates "normal" bytes (passed to xterm.js as-is) from OSC 133/7 sequences (converted into typed events: `PromptStarted`, `CommandStarted(raw)`, `CommandFinished(exitCode)`, `CwdChanged(path)`).
- These events are relayed over IPC (`shell:event`) to every renderer module that needs them.

### 4.2 Danger traffic light (terminal)
- While the user types, the renderer sends the current buffer (debounced) to `bash-parser.ts` (via IPC) to get a simplified AST.
- `danger-classifier.ts` applies **deterministic rules**, not AI: a table of commands with a base level (read-only/modifying/destructive), overrides for flags (`-rf`, `--force`), presence of `sudo`, sensitive paths (`/`, `/etc`, a bare `$HOME`, dangerous wildcards). Returns `DangerLevel: safe | caution | destructive` plus an explained reason.
- The xterm.js input border/background is colored accordingly. `destructive` level blocks `Enter` until the user confirms in a dialog that explains what's about to happen (reusing text from `commands.json`).

### 4.3 Copilot subtitles
- Reuses the same parser AST: breaks the command into tokens (command, subcommand, flags, arguments) and queries `command-dictionary.ts` for a plain-language description of each part, updating on every keystroke.

### 4.4 Translated errors
- On receiving `CommandFinished(exitCode != 0)`, main captures the recent `stderr` (a bounded pty buffer) and matches it against `error-catalog.ts` patterns (regex + command context). On a match, it emits an event with an explanation + suggestion; with no match, the raw error is shown without inventing an explanation.

### 4.5 Filesystem map (phase 2)
- `fs-tree.service.ts` builds the tree on demand (lazily, per directory) using `fs.readdir`. It syncs with `CwdChanged` to move the "📍 you are here" indicator and expand the active branch.

### 4.6 History as a diary (phase 2)
- `history.store.ts` persists every executed command (command, cwd, timestamp, exit code, duration) in a simple local store (JSON or embedded SQLite, decided in phase 2 based on query needs).
- Natural-language label: derived from the same dictionary used for subtitles (same AST → same description), no duplicated logic.
- "Save as a recipe": the user names a command from the history; it's saved separately and can be re-run from the diary.

### 4.7 Natural language with training wheels (phase 3)
- `ai-provider.ts` defines a minimal common interface (`generateCommand(prompt, context) → { command, explanation, dangerLevel }`) implemented by `gemini.provider.ts` and `anthropic.provider.ts`.
- `ai-service.ts` (main, the only place that touches the API): picks the provider by reading `AI_PROVIDER` (`gemini` by default, `anthropic` as an alternative) and the matching key (`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) from environment variables — the key never reaches the renderer.
- Every provider must return **structured JSON**, and `ai-service.ts` always **re-validates the `dangerLevel` against the local deterministic classifier** before showing it (AI is never the source of truth for danger, regardless of provider).
- The help level decides the behavior: high → inserts the ready-to-run command; medium → shows it and asks the user to type it; low → hints only (no full command).
- With no key configured for the active provider, the panel shows setup instructions (`.env.example` documents both variables) instead of failing.
- Adding a third provider (e.g. OpenAI) means implementing `AiProvider` and registering the value in `AI_PROVIDER` — nothing else in the app changes.

### 4.8 Pipeline view and rich output (phase 3)
- For commands with `|`, the tree-sitter-bash AST already separates the stages; each stage is run separately (or the combined output is intercepted and segmented) to show intermediate output per stage.
- "View as table": command-specific parsers for known commands (`ls -l`, `ps`, `df`) that turn tabular text into sortable rows/columns; an unrecognized command gets no button — no structure is invented.

### 4.9 Safety net (phase 3)
- `preview.service.ts`: before running an `rm`/`mv` flagged as destructive, resolves the globs/paths involved (without running the command) and lists them.
- `trash.service.ts`: implements the freedesktop spec (`~/.local/share/Trash/files` + `.trashinfo`), and rewrites a destructive `rm` (with confirmation) into a move to trash when the user accepts; undo = restore from there.

### 4.10 Help level slider (cross-cutting)
- Global state in `HelpLevelContext` (3 levels minimum: high/medium/low), persisted in `localStorage`/user config.
- Every module reads the level and decides its own behavior (how much text, panel visibility, how assertive the AI is) — the context imposes no UI logic on modules, it only exposes the value.

## 5. Event flow: shell → modules → interface

```
node-pty (raw stdout)
   │
   ▼
osc-parser.ts (main)
   │            \
   │             \── "normal" data ──► IPC "pty:data" ──► xterm.js (TerminalPane)
   │
   ├── PromptStarted / CommandStarted(raw) / CommandFinished(exitCode) / CwdChanged(path)
   │
   ▼
IPC "shell:event" (typed, one semantic channel per event)
   │
   ├──► ShellEventsContext (renderer) ──► FilesystemMap (CwdChanged)
   │                                  ├──► HistoryDiary (CommandFinished)
   │                                  └──► ErrorCard (CommandFinished with exitCode≠0
   │                                        → requests analysis from error-catalog via IPC)
   │
   └── In parallel, while the user types (independent of OSC):
        user input (renderer, debounced)
           │
           ▼
        IPC "command:analyze" ──► bash-parser.ts + danger-classifier.ts (main)
           │
           ▼
        AST + DangerLevel ──► TerminalPane (traffic light) + Subtitles + Cheatsheet
```

The main process is the single source of truth for: parsing, danger classification, local data access and AI calls. The renderer never decides danger or parses bash on its own — it requests and renders.

## 6. Conventions (reminder, also in CLAUDE.md after this plan was approved)

- Code, identifiers, comments, docs and commit messages in English; UI text in Spanish, centralized in `shared/i18n/es.json`.
- `contextIsolation: true`, `nodeIntegration: false`; all communication through the typed `ipc-contract.ts`.
- Unit tests required for: `osc-parser`, `bash-parser` (wrapper), `danger-classifier`, `error-catalog`.
- Small, descriptive commits, periodic push (also in CLAUDE.md).
- Original visual design, with real light/dark mode (not just inverted colors).

## 7. Phases (reminder of the brief)

- **Phase 1 (MVP):** real terminal + OSC 133/OSC 7 + subtitles + danger traffic light + translated errors + three-column layout (columns for later phases show an elegant empty state).
- **Phase 2:** filesystem map + history-diary with recipes + help level slider wired to everything.
- **Phase 3:** natural language with training wheels + pipeline view + rich output + safety net (preview, trash, undo).

At the end of each phase: verify it builds, tests pass and it starts; summarize what was done, what's left, and any decisions made independently.

## 8. Open decisions I'll default to unless told otherwise

1. **History persistence**: starting with plain JSON in `userData` (simple, enough for phase 2); if phase 2 needs richer querying/filtering, migrate to `better-sqlite3` without changing `HistoryStore`'s public interface.
2. **Dictionary/catalog format**: plain JSON validated with `zod` at load time (fails fast and explains malformed data), not YAML or TOML.
3. **tree-sitter-bash**: using `web-tree-sitter` (WASM) to avoid an extra native build in main besides node-pty.
4. **Destructive command confirmation**: a blocking modal inside the terminal itself (not a native OS dialog), to keep the design coherent.
