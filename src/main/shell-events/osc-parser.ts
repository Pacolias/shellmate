import type { ShellEvent } from '@shared/types/shell-events';

const ESC = '\x1b';
const BEL = '\x07';
// Real OSC 133/7 sequences we emit are a few dozen bytes at most. If a
// sequence never terminates within this many bytes, something is malformed
// (or this isn't actually one of ours) — stop waiting and pass it through
// rather than buffering the rest of the session's output forever.
const MAX_PENDING_LENGTH = 8192;

export interface OscParserCallbacks {
  /** Raw bytes meant for the terminal renderer, unmodified. */
  onData: (chunk: string) => void;
  onShellEvent: (event: ShellEvent) => void;
}

/**
 * Incrementally scans a raw pty output stream, extracting the OSC 133
 * (prompt/command boundaries) and OSC 7 (cwd) sequences our shell-init
 * scripts emit into typed ShellEvents, while passing every other byte
 * through untouched — including OSC sequences meant for xterm.js itself
 * (title changes, hyperlinks, etc.), which we never interpret.
 */
export class OscStreamParser {
  private pending = '';

  constructor(private readonly callbacks: OscParserCallbacks) {}

  feed(chunk: string): void {
    this.pending += chunk;
    this.drain();
  }

  private drain(): void {
    for (;;) {
      const escStart = this.pending.indexOf(ESC + ']');
      if (escStart === -1) {
        this.flushPlainData();
        return;
      }

      if (escStart > 0) {
        this.callbacks.onData(this.pending.slice(0, escStart));
        this.pending = this.pending.slice(escStart);
      }

      const terminator = findTerminator(this.pending);
      if (!terminator) {
        if (this.pending.length > MAX_PENDING_LENGTH) {
          this.callbacks.onData(this.pending);
          this.pending = '';
        }
        return;
      }

      const body = this.pending.slice(2, terminator.bodyEnd);
      const fullSequence = this.pending.slice(0, terminator.sequenceEnd);
      this.pending = this.pending.slice(terminator.sequenceEnd);

      const event = parseOscBody(body);
      if (event) {
        this.callbacks.onShellEvent(event);
      } else {
        this.callbacks.onData(fullSequence);
      }
    }
  }

  private flushPlainData(): void {
    // A lone trailing ESC could be the start of a sequence split across two
    // chunks — hold it back until more data arrives instead of emitting it.
    const holdBack = this.pending.endsWith(ESC) ? 1 : 0;
    const flushLength = this.pending.length - holdBack;
    if (flushLength <= 0) return;
    this.callbacks.onData(this.pending.slice(0, flushLength));
    this.pending = this.pending.slice(flushLength);
  }
}

interface Terminator {
  /** Index right after the OSC body, where the terminator starts. */
  bodyEnd: number;
  /** Index right after the terminator, where the next sequence can start. */
  sequenceEnd: number;
}

/** OSC sequences end with BEL (\x07) or the two-byte ST (\x1b\\). */
function findTerminator(buffer: string): Terminator | null {
  for (let i = 2; i < buffer.length; i++) {
    if (buffer[i] === BEL) {
      return { bodyEnd: i, sequenceEnd: i + 1 };
    }
    if (buffer[i] === ESC && buffer[i + 1] === '\\') {
      return { bodyEnd: i, sequenceEnd: i + 2 };
    }
  }
  return null;
}

function parseOscBody(body: string): ShellEvent | null {
  const separatorIndex = body.indexOf(';');
  const id = separatorIndex === -1 ? body : body.slice(0, separatorIndex);
  const payload = separatorIndex === -1 ? '' : body.slice(separatorIndex + 1);

  if (id === '133') return parsePromptEvent(payload);
  if (id === '7') return parseCwdEvent(payload);
  return null;
}

function parsePromptEvent(payload: string): ShellEvent | null {
  const marker = payload[0];
  switch (marker) {
    case 'A':
      return { type: 'prompt-started' };
    case 'C':
      return { type: 'command-started' };
    case 'D': {
      // Payload looks like "D;<exit_code>".
      const exitCode = Number.parseInt(payload.slice(2), 10);
      return { type: 'command-finished', exitCode: Number.isNaN(exitCode) ? 0 : exitCode };
    }
    default:
      // "B" (prompt end / input start) has no app-level event yet — it only
      // matters for click-to-move-cursor features we don't have.
      return null;
  }
}

function parseCwdEvent(payload: string): ShellEvent | null {
  const withoutScheme = payload.replace(/^file:\/\//, '');
  const pathStart = withoutScheme.indexOf('/');
  if (pathStart === -1) return null;
  return { type: 'cwd-changed', cwd: safeDecodeUriComponent(withoutScheme.slice(pathStart)) };
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
