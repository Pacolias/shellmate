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

  it('parses df -h output', () => {
    const raw = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      '/dev/sda1        50G   20G   28G  42% /',
    ].join('\n');
    const result = parseTabularOutput('df', raw);
    expect(result?.headers).toEqual(['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on']);
    expect(result?.rows[0]).toEqual(['/dev/sda1', '50G', '20G', '28G', '42%', '/']);
  });

  it('bails on ps-like output with fewer columns than the header promises', () => {
    const raw = ['PID TTY TIME CMD', 'not enough'].join('\n');
    expect(parseTabularOutput('ps', raw)).toBeNull();
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

  it('does not mistake plain ls output (no -l) for ls -l output', () => {
    const raw = 'a.txt  b.txt  folder';
    expect(parseTabularOutput('ls', raw)).toBeNull();
  });

  it('returns null for empty output', () => {
    expect(parseTabularOutput('ps', '')).toBeNull();
    expect(parseTabularOutput('du', '')).toBeNull();
  });
});
