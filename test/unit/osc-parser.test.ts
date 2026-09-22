import { describe, expect, it } from 'vitest';
import { OscStreamParser } from '../../src/main/shell-events/osc-parser';
import type { ShellEvent } from '../../shared/types/shell-events';

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

function run(chunks: string[]) {
  const data: string[] = [];
  const events: ShellEvent[] = [];
  const parser = new OscStreamParser({
    onData: (chunk) => data.push(chunk),
    onShellEvent: (event) => events.push(event),
  });
  for (const chunk of chunks) parser.feed(chunk);
  return { data: data.join(''), events };
}

describe('OscStreamParser', () => {
  it('passes plain text through untouched', () => {
    const { data, events } = run(['hello world\r\n']);
    expect(data).toBe('hello world\r\n');
    expect(events).toEqual([]);
  });

  it('extracts prompt-started from OSC 133;A', () => {
    const { data, events } = run(['\x1b]133;A\x07']);
    expect(data).toBe('');
    expect(events).toEqual([{ type: 'prompt-started' }]);
  });

  it('extracts command-started with the base64-decoded command text from OSC 133;C', () => {
    const { events } = run([`\x1b]133;C;${b64('rm -rf /tmp/x')}\x07`]);
    expect(events).toEqual([{ type: 'command-started', command: 'rm -rf /tmp/x' }]);
  });

  it('never throws on a malformed base64 payload, even if the decoded text is garbage', () => {
    const { events } = run(['\x1b]133;C;not-valid-base64!!!\x07']);
    expect(events).toEqual([{ type: 'command-started', command: expect.any(String) }]);
  });

  it('extracts command-finished with exit code from OSC 133;D;<code>', () => {
    const { events } = run(['\x1b]133;D;0\x07']);
    expect(events).toEqual([{ type: 'command-finished', exitCode: 0 }]);
  });

  it('parses non-zero exit codes', () => {
    const { events } = run(['\x1b]133;D;127\x07']);
    expect(events).toEqual([{ type: 'command-finished', exitCode: 127 }]);
  });

  it('ignores OSC 133;B (no app-level event, not passed through either)', () => {
    const { data, events } = run(['\x1b]133;B\x07']);
    expect(data).toBe('');
    expect(events).toEqual([]);
  });

  it('extracts cwd-changed from OSC 7 with a file:// URL', () => {
    const { events } = run(['\x1b]7;file://myhost/home/paco/projects\x07']);
    expect(events).toEqual([{ type: 'cwd-changed', cwd: '/home/paco/projects' }]);
  });

  it('URI-decodes the cwd path', () => {
    const { events } = run(['\x1b]7;file://myhost/home/paco/my%20project\x07']);
    expect(events).toEqual([{ type: 'cwd-changed', cwd: '/home/paco/my project' }]);
  });

  it('supports the ST terminator (ESC \\\\) as well as BEL', () => {
    const { events } = run(['\x1b]133;A\x1b\\']);
    expect(events).toEqual([{ type: 'prompt-started' }]);
  });

  it('passes through an unrecognized OSC 133 sub-marker rather than swallowing it', () => {
    const { data, events } = run(['\x1b]133;Z\x07']);
    expect(data).toBe('\x1b]133;Z\x07');
    expect(events).toEqual([]);
  });

  it('passes through a malformed OSC 7 payload rather than swallowing it', () => {
    const { data, events } = run(['\x1b]7;not-a-file-url\x07']);
    expect(data).toBe('\x1b]7;not-a-file-url\x07');
    expect(events).toEqual([]);
  });

  it('passes through OSC sequences it does not own, e.g. a window title', () => {
    const { data, events } = run(['\x1b]0;my title\x07']);
    expect(data).toBe('\x1b]0;my title\x07');
    expect(events).toEqual([]);
  });

  it('interleaves data and events in the order they appear', () => {
    const { data, events } = run([
      'before ',
      '\x1b]133;A\x07',
      'prompt$ ',
      `\x1b]133;C;${b64('echo hi')}\x07`,
      'output\r\n',
      '\x1b]133;D;0\x07',
    ]);
    expect(data).toBe('before prompt$ output\r\n');
    expect(events).toEqual([
      { type: 'prompt-started' },
      { type: 'command-started', command: 'echo hi' },
      { type: 'command-finished', exitCode: 0 },
    ]);
  });

  it('handles a sequence split across multiple feed() calls', () => {
    const { data, events } = run(['before\x1b', ']133;A\x07', 'after']);
    expect(data).toBe('beforeafter');
    expect(events).toEqual([{ type: 'prompt-started' }]);
  });

  it('handles a chunk boundary right after the lone ESC byte', () => {
    const { data, events } = run(['\x1b', ']7;file://host/a/b\x07']);
    expect(data).toBe('');
    expect(events).toEqual([{ type: 'cwd-changed', cwd: '/a/b' }]);
  });

  it('does not lose data waiting forever on an unterminated escape sequence', () => {
    const garbage = '\x1b]' + 'x'.repeat(9000);
    const { data, events } = run([garbage]);
    expect(data).toBe(garbage);
    expect(events).toEqual([]);
  });
});
