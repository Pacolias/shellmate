import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../src/main/command-analysis/bash-parser';

describe('parseCommand', () => {
  it('parses a simple command with flags and arguments', async () => {
    const result = await parseCommand('ls -la /tmp');
    expect(result.hasSyntaxError).toBe(false);
    expect(result.segments).toHaveLength(1);
    const [segment] = result.segments;
    expect(segment?.command).toBe('ls');
    expect(segment?.tokens.map((t) => [t.kind, t.text])).toEqual([
      ['command', 'ls'],
      ['flag', '-la'],
      ['argument', '/tmp'],
    ]);
  });

  it('treats sudo as the command name and the real command as an argument', async () => {
    const result = await parseCommand('sudo rm -rf /tmp/build');
    expect(result.segments).toHaveLength(1);
    const [segment] = result.segments;
    expect(segment?.command).toBe('sudo');
    expect(segment?.tokens.map((t) => t.text)).toEqual(['sudo', 'rm', '-rf', '/tmp/build']);
  });

  it('produces one segment per stage of a pipeline', async () => {
    const result = await parseCommand('ps aux | grep node');
    expect(result.segments.map((s) => s.command)).toEqual(['ps', 'grep']);
  });

  it('produces one segment per command in a && chain', async () => {
    const result = await parseCommand('mkdir out && cd out');
    expect(result.segments.map((s) => s.command)).toEqual(['mkdir', 'cd']);
  });

  it('returns no segments for empty input', async () => {
    const result = await parseCommand('   ');
    expect(result.segments).toEqual([]);
    expect(result.hasSyntaxError).toBe(false);
  });

  it('flags unterminated syntax as a syntax error without throwing', async () => {
    const result = await parseCommand('echo "unterminated');
    expect(result.hasSyntaxError).toBe(true);
  });

  it('captures a redirect as its own token, separate from arguments', async () => {
    const result = await parseCommand('echo hello > /etc/passwd');
    const [segment] = result.segments;
    expect(segment?.tokens.map((t) => [t.kind, t.text])).toEqual([
      ['command', 'echo'],
      ['argument', 'hello'],
      ['redirect', '> /etc/passwd'],
    ]);
  });

  it('records token byte offsets that round-trip against the raw input', async () => {
    const raw = 'rm -rf /tmp/build';
    const result = await parseCommand(raw);
    const tokens = result.segments[0]?.tokens ?? [];
    for (const token of tokens) {
      expect(raw.slice(token.start, token.end)).toBe(token.text);
    }
  });
});
