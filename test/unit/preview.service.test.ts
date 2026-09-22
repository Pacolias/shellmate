import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { previewDestructiveCommand } from '../../src/main/safety/preview.service';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'shellmate-preview-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('previewDestructiveCommand', () => {
  it('returns null for a command that is not rm or mv', async () => {
    expect(await previewDestructiveCommand('ls -la', tmpDir)).toBeNull();
  });

  it('resolves a literal rm target that exists', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), '');
    const result = await previewDestructiveCommand('rm a.txt', tmpDir);
    expect(result?.action).toBe('delete');
    expect(result?.targets).toEqual([{ pattern: 'a.txt', matches: [path.join(tmpDir, 'a.txt')], missing: false }]);
  });

  it('flags a literal rm target that does not exist as missing', async () => {
    const result = await previewDestructiveCommand('rm nope.txt', tmpDir);
    expect(result?.targets).toEqual([{ pattern: 'nope.txt', matches: [], missing: true }]);
  });

  it('expands a glob pattern against the real filesystem', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), '');
    await writeFile(path.join(tmpDir, 'b.txt'), '');
    await writeFile(path.join(tmpDir, 'c.md'), '');

    const result = await previewDestructiveCommand('rm *.txt', tmpDir);
    expect(result?.targets).toHaveLength(1);
    expect(result?.targets[0]?.matches.sort()).toEqual([path.join(tmpDir, 'a.txt'), path.join(tmpDir, 'b.txt')].sort());
    expect(result?.targets[0]?.missing).toBe(false);
  });

  it('resolves through sudo', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), '');
    const result = await previewDestructiveCommand('sudo rm a.txt', tmpDir);
    expect(result?.action).toBe('delete');
    expect(result?.targets[0]?.matches).toEqual([path.join(tmpDir, 'a.txt')]);
  });

  it('splits mv sources from its destination and does not glob-check the destination', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), '');
    await mkdir(path.join(tmpDir, 'dest'));

    const result = await previewDestructiveCommand('mv a.txt dest', tmpDir);
    expect(result?.action).toBe('move');
    expect(result?.destination).toBe(path.join(tmpDir, 'dest'));
    expect(result?.targets).toEqual([{ pattern: 'a.txt', matches: [path.join(tmpDir, 'a.txt')], missing: false }]);
  });
});
