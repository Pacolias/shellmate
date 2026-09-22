/**
 * A tiny shared snapshot of "what's happening in the one pty session right
 * now" that IPC handlers besides pty.handlers.ts need without re-plumbing
 * it through every function signature — currently just the cwd, for
 * pipeline-preview.service.ts to run a background re-execution in the
 * right directory. A module-level singleton is fine here because there is
 * exactly one pty session per app instance (see PLAN.md — multi-window/
 * multi-session is out of scope); pty.handlers.ts is the only writer.
 */
export interface CurrentSessionState {
  cwd: string | null;
}

export const currentSessionState: CurrentSessionState = { cwd: null };
