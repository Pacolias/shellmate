/** Emitted right before the shell draws a new prompt (OSC 133;A). */
export interface PromptStartedEvent {
  type: 'prompt-started';
}

/**
 * Emitted when the user's command starts executing (OSC 133;C). `command`
 * is the raw command text, captured shell-side ($BASH_COMMAND / zsh's
 * preexec argument) and base64-encoded over the wire so odd quoting never
 * corrupts the OSC payload — see journal/2026-09-22-command-capture.md.
 */
export interface CommandStartedEvent {
  type: 'command-started';
  command: string;
}

/** Emitted when the previous command finishes (OSC 133;D;<exit_code>). */
export interface CommandFinishedEvent {
  type: 'command-finished';
  exitCode: number;
}

/** Emitted whenever the shell's working directory changes (OSC 7). */
export interface CwdChangedEvent {
  type: 'cwd-changed';
  cwd: string;
}

export type ShellEvent =
  | PromptStartedEvent
  | CommandStartedEvent
  | CommandFinishedEvent
  | CwdChangedEvent;
