import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrashService } from '../../src/main/safety/trash.service';

let workDir: string;
let trashHome: string;
let originDir: string;
let trash: TrashService;

beforeEach(async () => {
  workDir = await mkdtemp(path.join(os.tmpdir(), 'shellmate-trash-'));
  trashHome = path.join(workDir, 'Trash');
  originDir = path.join(workDir, 'origin');
  await mkdir(originDir, { recursive: true });
  trash = new TrashService(trashHome);
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('TrashService', () => {
  it('moves a file out of its original location', async () => {
    const filePath = path.join(originDir, 'a.txt');
    await writeFile(filePath, 'hello');

    const [outcome] = await trash.moveToTrash([filePath]);
    expect(outcome?.success).toBe(true);
    expect(outcome?.trashedName).toBeTruthy();

    await expect(readFile(filePath, 'utf8')).rejects.toThrow();
    const trashedContent = await readFile(path.join(trashHome, 'files', outcome!.trashedName!), 'utf8');
    expect(trashedContent).toBe('hello');
  });

  it('writes a .trashinfo file with the original absolute path', async () => {
    const filePath = path.join(originDir, 'a.txt');
    await writeFile(filePath, 'hello');

    const [outcome] = await trash.moveToTrash([filePath]);
    const info = await readFile(path.join(trashHome, 'info', `${outcome!.trashedName}.trashinfo`), 'utf8');
    expect(info).toContain('[Trash Info]');
    expect(info).toContain(`Path=${filePath}`);
    expect(info).toMatch(/DeletionDate=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('disambiguates two trashed files with the same basename', async () => {
    const subA = path.join(originDir, 'a');
    const subB = path.join(originDir, 'b');
    await Promise.all([mkdir(subA), mkdir(subB)]);
    await writeFile(path.join(subA, 'note.txt'), 'from a');
    await writeFile(path.join(subB, 'note.txt'), 'from b');

    const outcomes = await trash.moveToTrash([path.join(subA, 'note.txt'), path.join(subB, 'note.txt')]);
    expect(outcomes.every((o) => o.success)).toBe(true);
    expect(outcomes[0]?.trashedName).not.toBe(outcomes[1]?.trashedName);

    const files = await readdir(path.join(trashHome, 'files'));
    expect(files).toHaveLength(2);
  });

  it('restores a trashed file to its original location', async () => {
    const filePath = path.join(originDir, 'a.txt');
    await writeFile(filePath, 'hello');
    const [trashed] = await trash.moveToTrash([filePath]);

    const [restored] = await trash.restoreFromTrash([trashed!.trashedName!]);
    expect(restored?.success).toBe(true);
    expect(restored?.originalPath).toBe(filePath);
    expect(await readFile(filePath, 'utf8')).toBe('hello');
  });

  it('removes the .trashinfo file once restored', async () => {
    const filePath = path.join(originDir, 'a.txt');
    await writeFile(filePath, 'hello');
    const [trashed] = await trash.moveToTrash([filePath]);
    await trash.restoreFromTrash([trashed!.trashedName!]);

    await expect(readFile(path.join(trashHome, 'info', `${trashed!.trashedName}.trashinfo`), 'utf8')).rejects.toThrow();
  });

  it('moves a whole directory, not just files', async () => {
    const dirPath = path.join(originDir, 'a-folder');
    await mkdir(dirPath);
    await writeFile(path.join(dirPath, 'inside.txt'), 'contents');

    const [outcome] = await trash.moveToTrash([dirPath]);
    expect(outcome?.success).toBe(true);
    const restoredInside = await readFile(path.join(trashHome, 'files', outcome!.trashedName!, 'inside.txt'), 'utf8');
    expect(restoredInside).toBe('contents');
  });

  it('reports failure without throwing when the source does not exist', async () => {
    const outcomes = await trash.moveToTrash([path.join(originDir, 'missing.txt')]);
    expect(outcomes[0]?.success).toBe(false);
    expect(outcomes[0]?.error).toBeTruthy();
  });

  it('reports failure without throwing when restoring an unknown trashedName', async () => {
    const outcomes = await trash.restoreFromTrash(['not-a-real-entry']);
    expect(outcomes[0]?.success).toBe(false);
  });
});
