import { describe, expect, it } from 'vitest';
import { parseTabularOutput } from '../../src/renderer/src/modules/terminal/table-parsers';

describe('parseTabularOutput', () => {
  it('returns null for an unrecognized command', () => {
    expect(parseTabularOutput('cat', 'a\nb\nc')).toBeNull();
  });

  it('returns null when the command name is null', () => {
    expect(parseTabularOutput(null, 'a\nb')).toBeNull();
  });

  it('parses ps-style output, merging overflow into the last column', () => {
    const raw = ['  PID TTY          TIME CMD', '  123 pts/0    00:00:01 node server.js --watch'].join('\n');
    const result = parseTabularOutput('ps', raw);
    expect(result?.headers).toEqual(['PID', 'TTY', 'TIME', 'CMD']);
    expect(result?.rows).toEqual([['123', 'pts/0', '00:00:01', 'node server.js --watch']]);
  });

  it('parses a real `ps aux` header, including columns starting with %', () => {
    const raw = [
      'USER  PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
      'paco  123  0.5  1.2 987654 54321 pts/0    Sl   10:00   0:10 node server.js --watch',
    ].join('\n');
    const result = parseTabularOutput('ps', raw);
    expect(result?.headers).toEqual(['USER', 'PID', '%CPU', '%MEM', 'VSZ', 'RSS', 'TTY', 'STAT', 'START', 'TIME', 'COMMAND']);
    expect(result?.rows[0]).toEqual(['paco', '123', '0.5', '1.2', '987654', '54321', 'pts/0', 'Sl', '10:00', '0:10', 'node server.js --watch']);
  });

  it('parses df -h output', () => {
    const raw = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      '/dev/sda1        50G   20G   28G  42% /',
    ].join('\n');
    const result = parseTabularOutput('df', raw);
    expect(result?.headers).toEqual(['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on']);
    expect(result?.rows[0]).toEqual(['/dev/sda1', '50G', '20G', '28G', '42%', '/']);
  });

  it('returns null when no row has enough columns to match the header', () => {
    const raw = ['PID TTY TIME CMD', 'not enough'].join('\n');
    expect(parseTabularOutput('ps', raw)).toBeNull();
  });

  it('skips a stray malformed line instead of failing the whole table', () => {
    const raw = [
      'PID TTY TIME CMD',
      '123 pts/0 00:00:01 node',
      'too short',
      '456 pts/1 00:00:02 bash',
    ].join('\n');
    const result = parseTabularOutput('ps', raw);
    expect(result?.rows).toEqual([
      ['123', 'pts/0', '00:00:01', 'node'],
      ['456', 'pts/1', '00:00:02', 'bash'],
    ]);
  });

  it('does not treat free\'s "Mem:"/"Swap:" row-label format as a header match', () => {
    const raw = ['              total        used        free', 'Mem:           7943        2145        3421'].join('\n');
    expect(parseTabularOutput('free', raw)).toBeNull();
  });

  it('parses du output (size + path, no header)', () => {
    const raw = ['4.0K\t./a', '8.0K\t./b/c'].join('\n');
    const result = parseTabularOutput('du', raw);
    expect(result?.headers).toEqual(['Tamaño', 'Ruta']);
    expect(result?.rows).toEqual([
      ['4.0K', './a'],
      ['8.0K', './b/c'],
    ]);
  });

  it('parses ls -l output, keeping spaces in the filename', () => {
    const raw = [
      'total 8',
      '-rw-r--r-- 1 paco paco  220 Sep 22 10:00 my file.txt',
      'drwxr-xr-x 2 paco paco 4096 Sep 22 10:01 folder',
    ].join('\n');
    const result = parseTabularOutput('ls', raw);
    expect(result?.headers).toEqual(['Permisos', 'Enlaces', 'Dueño', 'Grupo', 'Tamaño', 'Fecha', 'Nombre']);
    expect(result?.rows[0]).toEqual(['-rw-r--r--', '1', 'paco', 'paco', '220', 'Sep 22 10:00', 'my file.txt']);
    expect(result?.rows[1]?.[6]).toBe('folder');
  });

  it('parses a real ls -l -> symlink line, keeping the arrow and target together', () => {
    const raw = 'lrwxrwxrwx. 1 paco paco 30 Sep 22 10:36 link.sock -> /run/user/1000/link.sock';
    const result = parseTabularOutput('ls', raw);
    expect(result?.rows[0]?.[6]).toBe('link.sock -> /run/user/1000/link.sock');
  });

  it('strips ANSI color codes from a `ls --color` alias before parsing', () => {
    const raw = '-rw-r--r--. 1 paco paco 29 Sep 22 19:18 \u001b[0m\u001b[01;34mprobe.mjs\u001b[0m';
    const result = parseTabularOutput('ls', raw);
    expect(result?.rows[0]?.[6]).toBe('probe.mjs');
  });

  it('ignores trailing shell-theme/VTE integration noise sharing the same captured output', () => {
    // A real capture can include another precmd hook's own output (a
    // themed prompt marker, VTE's OSC 666) appended after the command's
    // real output but before our own OSC 133;D fires.
    const raw =
      '-rw-r--r--. 1 paco paco 29 Sep 22 19:18 probe.mjs\r\n' +
      '\u001b[1m\u001b[7m%\u001b[27m\u001b[1m\u001b[0m   \r \r\u001b]666;vte.shell.postexec=0\u001b\\\u001b]2;paco@fedora:~\u0007';
    const result = parseTabularOutput('ls', raw);
    expect(result?.rows).toEqual([['-rw-r--r--.', '1', 'paco', 'paco', '29', 'Sep 22 19:18', 'probe.mjs']]);
  });

  it('does not mistake plain ls output (no -l) for ls -l output', () => {
    const raw = 'a.txt  b.txt  folder';
    expect(parseTabularOutput('ls', raw)).toBeNull();
  });

  it('returns null for empty output', () => {
    expect(parseTabularOutput('ps', '')).toBeNull();
    expect(parseTabularOutput('du', '')).toBeNull();
    expect(parseTabularOutput('ls', '')).toBeNull();
  });
});
