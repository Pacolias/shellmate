// A real command's error output rarely needs more than a screen or two of
// context to match against the error catalog; capping this avoids the
// buffer growing unbounded for a long-running command that prints a lot.
const MAX_BUFFER_LENGTH = 8000;

/**
 * Tracks the terminal output produced since the current command started,
 * so it can be matched against error-catalog.ts if the command fails. Reset
 * on every command-started event; read on command-finished.
 */
export class RecentOutputTracker {
  private buffer = '';

  reset(): void {
    this.buffer = '';
  }

  append(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > MAX_BUFFER_LENGTH) {
      this.buffer = this.buffer.slice(this.buffer.length - MAX_BUFFER_LENGTH);
    }
  }

  snapshot(): string {
    return this.buffer;
  }
}
