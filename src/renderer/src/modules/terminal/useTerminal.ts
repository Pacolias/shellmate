import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { CommandAnalysis } from '@shared/types/command';
import { applyKeystroke } from './line-buffer';
import { resolveXtermTheme } from './xterm-theme';

const ANALYZE_DEBOUNCE_MS = 150;
// A ctrl+U the code sends itself to discard a stale line (e.g. after
// moving files to the trash instead of running the typed rm) — a plain
// escape sequence, not routed through the destructive-confirmation gate.
const CLEAR_LINE = '\x15';

export interface ConfirmDestructiveDetails {
  command: string;
  reason: string;
}

export interface UseTerminalOptions {
  /** Called with the live analysis of the current input line, or null once it's empty/submitted. */
  onAnalysisChange: (analysis: CommandAnalysis | null) => void;
  /** Awaited before a destructive command's Enter reaches the shell. Resolving false cancels it — the line stays in the shell's input buffer, untouched. */
  onConfirmDestructive: (details: ConfirmDestructiveDetails) => Promise<boolean>;
  /** The raw output produced by the command that just finished (regardless of exit code), for the "view as table" feature — real terminals don't expose this after the fact, so it's captured as it streams by. */
  onCommandFinished?: (command: string | null, rawOutput: string) => void;
}

export interface UseTerminalHandle {
  /**
   * Feeds text into the terminal exactly as if it had been typed, one
   * character at a time through the same path real keystrokes take — so a
   * recipe run from the history diary gets the same live danger analysis
   * and destructive-command confirmation as anything the user types by
   * hand. Deliberately does not send Enter — the user still has to submit
   * it themselves.
   */
  insertText: (text: string) => Promise<void>;
  /** Sends Ctrl+U — discards whatever's currently typed, in both the real shell and our local tracking. Used after moving files to the trash instead of running the rm the user actually typed, so a stray Enter afterwards can't resubmit a now-stale command. */
  clearCurrentLine: () => void;
  /** Writes text straight to the terminal display — never sent to the shell. Used for local, app-generated messages (e.g. a trash confirmation) that aren't shell output. */
  writeSystemLine: (text: string) => void;
}

/**
 * Owns the xterm.js instance and its connection to the real pty over the
 * shellmate bridge: writes keystrokes through, renders incoming data, keeps
 * a local approximation of the current input line for live analysis (see
 * line-buffer.ts), and gates Enter on confirmation when that analysis says
 * the command is destructive.
 */
export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseTerminalOptions,
): UseTerminalHandle {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const handleInputRef = useRef<((input: string) => Promise<void>) | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      theme: resolveXtermTheme(),
    });
    terminalRef.current = terminal;
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    let lineBuffer = '';
    let latestAnalysis: CommandAnalysis | null = null;
    let analyzeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastCommandText: string | null = null;
    let outputSinceCommandStart = '';

    const scheduleAnalysis = (input: string): void => {
      clearTimeout(analyzeTimer);
      if (input.trim().length === 0) {
        latestAnalysis = null;
        optionsRef.current.onAnalysisChange(null);
        return;
      }
      analyzeTimer = setTimeout(() => {
        void window.shellmate.command.analyze(input).then((analysis) => {
          latestAnalysis = analysis;
          optionsRef.current.onAnalysisChange(analysis);
        });
      }, ANALYZE_DEBOUNCE_MS);
    };

    void window.shellmate.pty.start({ cols: terminal.cols, rows: terminal.rows });

    const offData = window.shellmate.pty.onData((chunk) => {
      outputSinceCommandStart += chunk;
      terminal.write(chunk);
    });
    const offExit = window.shellmate.pty.onExit(() => {
      terminal.write('\r\n\x1b[2m[shell exited]\x1b[0m\r\n');
    });
    const offShellEvent = window.shellmate.shell.onEvent((event) => {
      if (event.type === 'command-started') {
        lastCommandText = event.command;
        outputSinceCommandStart = '';
      }
      if (event.type === 'command-finished') {
        optionsRef.current.onCommandFinished?.(lastCommandText, outputSinceCommandStart);
      }
    });

    const inputDisposable = terminal.onData((input) => {
      void handleInput(input);
    });

    handleInputRef.current = handleInput;

    async function handleInput(input: string): Promise<void> {
      const isEnter = input === '\r' || input === '\n';

      if (isEnter && latestAnalysis?.danger.level === 'destructive') {
        terminal.options.disableStdin = true;
        const confirmed = await optionsRef.current.onConfirmDestructive({
          command: lineBuffer,
          reason: latestAnalysis.danger.reason,
        });
        terminal.options.disableStdin = false;
        terminal.focus();
        if (!confirmed) return;
      }

      window.shellmate.pty.write(input);

      const update = applyKeystroke(lineBuffer, input);
      lineBuffer = update.buffer;
      if (update.submitted) {
        clearTimeout(analyzeTimer);
        latestAnalysis = null;
        optionsRef.current.onAnalysisChange(null);
      } else {
        scheduleAnalysis(lineBuffer);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      window.shellmate.pty.resize(terminal.cols, terminal.rows);
    });
    resizeObserver.observe(container);

    return () => {
      handleInputRef.current = null;
      terminalRef.current = null;
      resizeObserver.disconnect();
      inputDisposable.dispose();
      offData();
      offExit();
      offShellEvent();
      clearTimeout(analyzeTimer);
      terminal.dispose();
    };
  }, [containerRef]);

  const insertText = useCallback(async (text: string) => {
    for (const char of text) {
      await handleInputRef.current?.(char);
    }
  }, []);

  const clearCurrentLine = useCallback(() => {
    void handleInputRef.current?.(CLEAR_LINE);
  }, []);

  const writeSystemLine = useCallback((text: string) => {
    terminalRef.current?.write(`\r\n${text}\r\n`);
  }, []);

  return { insertText, clearCurrentLine, writeSystemLine };
}
