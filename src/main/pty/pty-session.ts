import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';

// electron-vite bundles the main process into a single out/main/index.js, so
// this always resolves relative to that directory, not to this source
// file's location — shell-init/ is copied there at build time (see
// electron.vite.config.ts's viteStaticCopy targets).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SHELL_INIT_DIR = path.join(moduleDir, 'shell-init');

export interface PtySessionOptions {
  cols: number;
  rows: number;
  cwd?: string;
}

export type PtyDataListener = (chunk: string) => void;
export type PtyExitListener = (exitCode: number) => void;

/**
 * Thin wrapper around node-pty that launches the user's actual shell
 * (bash/zsh), configured to emit OSC 133/7 sequences without touching the
 * user's own rc files. See shell-init/ for the injected scripts and
 * journal/2026-09-22-* for why each shell needs a different trick.
 */
export class PtySession {
  private ptyProcess: pty.IPty | null = null;
  private readonly dataListeners = new Set<PtyDataListener>();
  private readonly exitListeners = new Set<PtyExitListener>();

  start(options: PtySessionOptions): void {
    if (this.ptyProcess) {
      throw new Error('PtySession already started');
    }

    const shell = detectShell();
    this.ptyProcess = pty.spawn(shell.bin, shell.args, {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd ?? os.homedir(),
      env: buildEnv(shell),
    });

    this.ptyProcess.onData((chunk) => {
      for (const listener of this.dataListeners) listener(chunk);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      for (const listener of this.exitListeners) listener(exitCode);
      this.ptyProcess = null;
    });
  }

  write(data: string): void {
    this.ptyProcess?.write(data);
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess?.resize(cols, rows);
  }

  onData(listener: PtyDataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onExit(listener: PtyExitListener): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  dispose(): void {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }
}

type ShellKind = 'bash' | 'zsh' | 'other';

interface ShellDescriptor {
  kind: ShellKind;
  bin: string;
  args: string[];
}

function detectShell(): ShellDescriptor {
  const shellPath = process.env.SHELL || '/bin/bash';
  const name = path.basename(shellPath);

  if (name === 'bash') {
    return {
      kind: 'bash',
      bin: shellPath,
      args: ['--rcfile', path.join(SHELL_INIT_DIR, 'shellmate.bash')],
    };
  }

  if (name === 'zsh') {
    // zsh has no --rcfile equivalent; ZDOTDIR is redirected instead (see
    // buildEnv) and restored by our .zshrc once its hooks are installed.
    return { kind: 'zsh', bin: shellPath, args: [] };
  }

  // Unknown shell: fall back to a plain bash session without integration
  // rather than guessing at a foreign shell's startup mechanism.
  return { kind: 'other', bin: '/bin/bash', args: [] };
}

function buildEnv(shell: ShellDescriptor): Record<string, string> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    SHELLMATE: '1',
  };

  if (shell.kind === 'zsh') {
    env.SHELLMATE_REAL_ZDOTDIR = process.env.ZDOTDIR || os.homedir();
    env.ZDOTDIR = path.join(SHELL_INIT_DIR, 'zsh-zdotdir');
  }

  return env;
}
