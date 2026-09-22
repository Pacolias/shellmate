import { describe, expect, it } from 'vitest';
import { applyKeystroke } from '../../src/renderer/src/modules/terminal/line-buffer';

describe('applyKeystroke', () => {
  it('appends printable characters', () => {
    expect(applyKeystroke('l', 's')).toEqual({ buffer: 'ls', submitted: false });
  });

  it('builds up a buffer over several keystrokes', () => {
    let buffer = '';
    for (const char of 'ls -la') {
      buffer = applyKeystroke(buffer, char).buffer;
    }
    expect(buffer).toBe('ls -la');
  });

  it('treats Enter as submission and clears the buffer', () => {
    expect(applyKeystroke('ls -la', '\r')).toEqual({ buffer: '', submitted: true });
  });

  it('removes the last character on backspace', () => {
    expect(applyKeystroke('ls -la', '\x7f')).toEqual({ buffer: 'ls -l', submitted: false });
  });

  it('does not go below an empty buffer on backspace', () => {
    expect(applyKeystroke('', '\x7f')).toEqual({ buffer: '', submitted: false });
  });

  it('clears the line on Ctrl+C', () => {
    expect(applyKeystroke('rm -rf', '\x03')).toEqual({ buffer: '', submitted: false });
  });

  it('clears the line on Ctrl+U', () => {
    expect(applyKeystroke('rm -rf', '\x15')).toEqual({ buffer: '', submitted: false });
  });

  it('ignores escape sequences like arrow keys without corrupting the buffer', () => {
    expect(applyKeystroke('ls -la', '\x1b[D')).toEqual({ buffer: 'ls -la', submitted: false });
  });

  it('handles a multi-character paste in one call', () => {
    expect(applyKeystroke('', 'ls -la /tmp')).toEqual({ buffer: 'ls -la /tmp', submitted: false });
  });

  it('strips embedded newlines out of a multi-line paste', () => {
    expect(applyKeystroke('', 'echo hi\nls')).toEqual({ buffer: 'echo hils', submitted: false });
  });
});
