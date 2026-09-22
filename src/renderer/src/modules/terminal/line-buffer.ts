const CLEAR_LINE_KEYS = new Set(['\x03', '\x15']); // Ctrl+C, Ctrl+U
const BACKSPACE_KEYS = new Set(['\x7f', '\b']);

export interface LineBufferUpdate {
  buffer: string;
  /** True when this keystroke was Enter — the caller should treat `buffer` as submitted and stop analyzing it. */
  submitted: boolean;
}

/**
 * Approximates the current input line from raw keystrokes typed into
 * xterm.js, well enough for the danger semaphore and subtitles to react to
 * ordinary linear typing and backspacing. It does not track cursor
 * position, so arrow-key editing will drift from what the real shell sees
 * — see journal/2026-09-22-line-buffer-approximation.md.
 */
export function applyKeystroke(buffer: string, input: string): LineBufferUpdate {
  if (input === '\r' || input === '\n') {
    return { buffer: '', submitted: true };
  }
  if (CLEAR_LINE_KEYS.has(input)) {
    return { buffer: '', submitted: false };
  }
  if (BACKSPACE_KEYS.has(input)) {
    return { buffer: buffer.slice(0, -1), submitted: false };
  }
  if (input.startsWith('\x1b')) {
    // Arrow keys, alt-combinations, etc. — not tracked, see module docstring.
    return { buffer, submitted: false };
  }

  const printable = Array.from(input).filter((char) => (char.codePointAt(0) ?? 0) >= 0x20);
  return { buffer: buffer + printable.join(''), submitted: false };
}
