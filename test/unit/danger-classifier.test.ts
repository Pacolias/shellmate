import { describe, expect, it } from 'vitest';
import { classifyCommand } from '../../src/main/command-analysis/danger-classifier';
import type { ParsedCommand, ParsedSegment } from '../../shared/types/command';

function segment(command: string, args: string[]): ParsedSegment {
  const tokens: ParsedSegment['tokens'] = [{ kind: 'command', text: command, start: 0, end: command.length }];
  let offset = command.length;
  for (const arg of args) {
    offset += 1; // space
    tokens.push({
      kind: arg.startsWith('-') ? 'flag' : 'argument',
      text: arg,
      start: offset,
      end: offset + arg.length,
    });
    offset += arg.length;
  }
  return { command, tokens };
}

function parsed(...segments: ParsedSegment[]): ParsedCommand {
  return { raw: '', segments, hasSyntaxError: false };
}

function segmentWithRedirect(command: string, args: string[], redirectText: string): ParsedSegment {
  const base = segment(command, args);
  base.tokens.push({ kind: 'redirect', text: redirectText, start: 0, end: redirectText.length });
  return base;
}

describe('classifyCommand', () => {
  it('treats an empty command line as safe', () => {
    expect(classifyCommand(parsed())).toEqual({ level: 'safe', reason: expect.any(String) });
  });

  it('treats a known read-only command as safe', () => {
    const result = classifyCommand(parsed(segment('ls', ['-la'])));
    expect(result.level).toBe('safe');
  });

  it('defaults unknown commands to caution, not safe', () => {
    const result = classifyCommand(parsed(segment('some-unknown-tool', ['--flag'])));
    expect(result.level).toBe('caution');
    expect(result.reason).toMatch(/no está en nuestro diccionario/);
  });

  it('treats plain rm of a single file as caution, not destructive', () => {
    const result = classifyCommand(parsed(segment('rm', ['file.txt'])));
    expect(result.level).toBe('caution');
  });

  it('escalates rm -rf to destructive', () => {
    const result = classifyCommand(parsed(segment('rm', ['-rf', 'build/'])));
    expect(result.level).toBe('destructive');
    expect(result.reason).toMatch(/protegidos/);
  });

  it('escalates rm -r (without force) to destructive too', () => {
    const result = classifyCommand(parsed(segment('rm', ['-r', 'build/'])));
    expect(result.level).toBe('destructive');
    expect(result.reason).not.toMatch(/protegidos/);
  });

  it('escalates rm --recursive (long form) to destructive', () => {
    const result = classifyCommand(parsed(segment('rm', ['--recursive', 'build/'])));
    expect(result.level).toBe('destructive');
  });

  it('does not treat --no-preserve-root as a recursive flag by itself', () => {
    // rm requires -r for this to matter at all; on its own this flag isn't
    // recursive, it just changes what -r --no-preserve-root would do.
    const result = classifyCommand(parsed(segment('rm', ['--no-preserve-root', 'file.txt'])));
    expect(result.level).toBe('caution');
  });

  it('does not escalate rmdir, which can only remove empty directories', () => {
    const result = classifyCommand(parsed(segment('rmdir', ['empty/'])));
    expect(result.level).toBe('safe');
  });

  it('escalates to destructive when a modifying command targets a sensitive path', () => {
    const result = classifyCommand(parsed(segment('chmod', ['-R', '777', '/'])));
    expect(result.level).toBe('destructive');
    expect(result.reason).toMatch(/ruta sensible/);
  });

  it('does not escalate a read-only command targeting a sensitive path', () => {
    const result = classifyCommand(parsed(segment('ls', ['/etc'])));
    expect(result.level).toBe('safe');
  });

  it('escalates sudo to at least caution even for an otherwise-safe command', () => {
    const result = classifyCommand(parsed(segment('sudo', ['ls', '/root'])));
    expect(result.level).toBe('caution');
  });

  it('resolves the effective command through sudo for classification', () => {
    const result = classifyCommand(parsed(segment('sudo', ['rm', '-rf', '/var/lib/important'])));
    expect(result.level).toBe('destructive');
  });

  it('never lowers sudo below caution even if the wrapped command is destructive', () => {
    const result = classifyCommand(parsed(segment('sudo', ['rm', '-rf', '/'])));
    expect(result.level).toBe('destructive');
  });

  it('takes the worst level across all segments of a pipeline/chain', () => {
    const result = classifyCommand(parsed(segment('ls', []), segment('rm', ['-rf', '/tmp/x'])));
    expect(result.level).toBe('destructive');
  });

  it('escalates an otherwise-safe command with a write redirect to caution', () => {
    const result = classifyCommand(parsed(segmentWithRedirect('echo', ['hello'], '> notes.txt')));
    expect(result.level).toBe('caution');
  });

  it('escalates a write redirect targeting a sensitive path to destructive', () => {
    const result = classifyCommand(parsed(segmentWithRedirect('echo', ['x'], '> /etc/passwd')));
    expect(result.level).toBe('destructive');
    expect(result.reason).toMatch(/ruta sensible/);
  });

  it('does not escalate a read redirect (input, not a write)', () => {
    const result = classifyCommand(parsed(segmentWithRedirect('cat', [], '< /etc/passwd')));
    expect(result.level).toBe('safe');
  });

  it('treats append (>>) the same as overwrite (>) for escalation', () => {
    const result = classifyCommand(parsed(segmentWithRedirect('echo', ['x'], '>> notes.txt')));
    expect(result.level).toBe('caution');
  });

  it('recognizes specific sensitive files, not just directories, as positional arguments', () => {
    const result = classifyCommand(parsed(segment('rm', ['/etc/shadow'])));
    expect(result.level).toBe('destructive');
  });
});
