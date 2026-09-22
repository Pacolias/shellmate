import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listDirectory } from '../../src/main/filesystem/fs-tree.service';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'shellmate-fs-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('listDirectory', () => {
  it('lists directories before files, each alphabetically', async () => {
    await writeFile(path.join(tmpDir, 'b.txt'), '');
    await writeFile(path.join(tmpDir, 'a.txt'), '');
    await mkdir(path.join(tmpDir, 'zdir'));
    await mkdir(path.join(tmpDir, 'adir'));

    const result = await listDirectory(tmpDir);

    expect(result.error).toBeNull();
    expect(result.entries.map((e) => [e.name, e.isDirectory])).toEqual([
      ['adir', true],
      ['zdir', true],
      ['a.txt', false],
      ['b.txt', false],
    ]);
  });

  it('hides dotfiles by default', async () => {
    await writeFile(path.join(tmpDir, '.hidden'), '');
    await writeFile(path.join(tmpDir, 'visible.txt'), '');

    const result = await listDirectory(tmpDir);

    expect(result.entries.map((e) => e.name)).toEqual(['visible.txt']);
  });

  it('returns an error instead of throwing for a missing directory', async () => {
    const result = await listDirectory(path.join(tmpDir, 'does-not-exist'));

    expect(result.entries).toEqual([]);
    expect(result.error).not.toBeNull();
  });

  it('returns an error instead of throwing when the path is a file, not a directory', async () => {
    const filePath = path.join(tmpDir, 'file.txt');
    await writeFile(filePath, '');

    const result = await listDirectory(filePath);

    expect(result.entries).toEqual([]);
    expect(result.error).not.toBeNull();
  });

  it('includes the full path for each entry', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), '');

    const result = await listDirectory(tmpDir);

    expect(result.entries[0]?.path).toBe(path.join(tmpDir, 'a.txt'));
  });
});
